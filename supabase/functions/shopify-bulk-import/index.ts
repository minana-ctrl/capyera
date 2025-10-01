import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')!;
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json().catch(() => ({} as any));
    const action = body.action || 'start'; // 'start', 'check', 'process'
    const operationId = body.operation_id;

    console.log(`Bulk import action: ${action}`);

    // START: Initiate bulk operation
    if (action === 'start') {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      const bulkQuery = `
        {
          orders(query: "created_at:>=${twoYearsAgo.toISOString().split('T')[0]}") {
            edges {
              node {
                id
                legacyResourceId
                name
                email
                createdAt
                updatedAt
                cancelledAt
                displayFinancialStatus
                displayFulfillmentStatus
                currentTotalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                currentSubtotalPriceSet {
                  shopMoney {
                    amount
                  }
                }
                currentShippingPriceSet {
                  shopMoney {
                    amount
                  }
                }
                customer {
                  firstName
                  lastName
                  email
                  numberOfOrders
                }
                shippingAddress {
                  address1
                  address2
                  city
                  province
                  country
                  countryCodeV2
                  zip
                }
                lineItems {
                  edges {
                    node {
                      id
                      name
                      sku
                      quantity
                      originalUnitPriceSet {
                        shopMoney {
                          amount
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await fetch(`https://${shopifyDomain}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation {
              bulkOperationRunQuery(
                query: """${bulkQuery}"""
              ) {
                bulkOperation {
                  id
                  status
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `
        }),
      });

      const result = await response.json();
      
      if (result.data?.bulkOperationRunQuery?.userErrors?.length > 0) {
        throw new Error(JSON.stringify(result.data.bulkOperationRunQuery.userErrors));
      }

      const bulkOp = result.data?.bulkOperationRunQuery?.bulkOperation;
      
      // Create import log
      const { data: importLog } = await supabase
        .from('import_logs')
        .insert({
          import_type: 'shopify_orders',
          status: 'in_progress',
          file_name: bulkOp.id,
        })
        .select()
        .single();

      console.log('Bulk operation started:', bulkOp.id);

      return new Response(
        JSON.stringify({
          success: true,
          operation_id: bulkOp.id,
          status: bulkOp.status,
          import_log_id: importLog?.id,
          message: 'Bulk operation started. Poll with action=check to see progress.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CHECK: Check bulk operation status
    if (action === 'check') {
      const response = await fetch(`https://${shopifyDomain}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query {
              currentBulkOperation {
                id
                status
                errorCode
                createdAt
                completedAt
                objectCount
                fileSize
                url
                partialDataUrl
              }
            }
          `
        }),
      });

      const result = await response.json();
      const bulkOp = result.data?.currentBulkOperation;

      if (!bulkOp) {
        return new Response(
          JSON.stringify({ success: false, message: 'No bulk operation found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Bulk operation status:', bulkOp.status, 'Objects:', bulkOp.objectCount);

      return new Response(
        JSON.stringify({
          success: true,
          operation_id: bulkOp.id,
          status: bulkOp.status,
          error_code: bulkOp.errorCode,
          object_count: bulkOp.objectCount,
          file_size: bulkOp.fileSize,
          url: bulkOp.url,
          partial_data_url: bulkOp.partialDataUrl,
          message: bulkOp.status === 'COMPLETED' 
            ? 'Ready to process. Call with action=process' 
            : `Status: ${bulkOp.status}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PROCESS: Download and import data
    if (action === 'process') {
      const url = body.url;
      if (!url) {
        throw new Error('URL required for processing');
      }

      console.log('Downloading bulk data from:', url);

      // Download JSONL file
      const dataResponse = await fetch(url);
      const jsonlText = await dataResponse.text();
      const lines = jsonlText.trim().split('\n');

      console.log(`Processing ${lines.length} lines...`);

      let recordsImported = 0;
      let recordsFailed = 0;
      const errorLog: any[] = [];

      // Parse JSONL and build order objects
      const ordersMap = new Map();
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const obj = JSON.parse(line);
          
          // Orders have __parentId, line items reference their parent order
          if (obj.__typename === 'Order') {
            ordersMap.set(obj.id, {
              ...obj,
              lineItems: []
            });
          } else if (obj.__typename === 'LineItem' && obj.__parentId) {
            const order = ordersMap.get(obj.__parentId);
            if (order) {
              order.lineItems.push(obj);
            }
          }
        } catch (err) {
          console.error('Error parsing line:', err);
        }
      }

      console.log(`Found ${ordersMap.size} orders`);

      // Import orders
      for (const [orderId, shopifyOrder] of ordersMap) {
        try {
          const isNewCustomer = shopifyOrder.customer?.numberOfOrders === 1;

          // Insert order
          const { data: insertedOrder, error: orderError } = await supabase
            .from('orders')
            .insert({
              shopify_order_id: shopifyOrder.legacyResourceId || orderId,
              order_number: shopifyOrder.name,
              status: shopifyOrder.displayFinancialStatus?.toLowerCase() || 'pending',
              fulfillment_status: shopifyOrder.displayFulfillmentStatus?.toLowerCase() || 'unfulfilled',
              customer_name: shopifyOrder.customer 
                ? `${shopifyOrder.customer.firstName || ''} ${shopifyOrder.customer.lastName || ''}`.trim()
                : 'Guest',
              customer_email: shopifyOrder.customer?.email || shopifyOrder.email,
              total_amount: parseFloat(shopifyOrder.currentTotalPriceSet?.shopMoney?.amount || '0'),
              product_revenue: parseFloat(shopifyOrder.currentSubtotalPriceSet?.shopMoney?.amount || '0'),
              shipping_cost: parseFloat(shopifyOrder.currentShippingPriceSet?.shopMoney?.amount || '0'),
              currency: shopifyOrder.currentTotalPriceSet?.shopMoney?.currencyCode || 'USD',
              placed_at: new Date(shopifyOrder.createdAt),
              fulfilled_at: shopifyOrder.displayFulfillmentStatus === 'FULFILLED' 
                ? new Date(shopifyOrder.updatedAt) 
                : null,
              cancelled_at: shopifyOrder.cancelledAt ? new Date(shopifyOrder.cancelledAt) : null,
              is_new_customer: isNewCustomer,
              shipping_address: shopifyOrder.shippingAddress || {},
              country_code: shopifyOrder.shippingAddress?.countryCodeV2 || null,
            })
            .select()
            .single();

          if (orderError) {
            console.error('Error inserting order:', orderError);
            recordsFailed++;
            errorLog.push({ order: shopifyOrder.name, error: orderError.message });
            continue;
          }

          // Insert line items
          for (const item of shopifyOrder.lineItems || []) {
            const { error: itemError } = await supabase
              .from('order_line_items')
              .insert({
                order_id: insertedOrder.id,
                sku: item.sku || 'UNKNOWN',
                product_name: item.name,
                quantity: item.quantity,
                unit_price: parseFloat(item.originalUnitPriceSet?.shopMoney?.amount || '0'),
                total_price: parseFloat(item.originalUnitPriceSet?.shopMoney?.amount || '0') * item.quantity,
                product_id: null,
                bundle_id: null,
              });

            if (itemError) {
              console.error('Error inserting line item:', itemError);
              errorLog.push({ order: shopifyOrder.name, item: item.name, error: itemError.message });
            }
          }

          recordsImported++;
        } catch (error) {
          console.error('Error processing order:', error);
          recordsFailed++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          errorLog.push({ order: shopifyOrder.name, error: errorMessage });
        }
      }

      // Update import log
      await supabase
        .from('import_logs')
        .update({
          status: recordsFailed > 0 ? 'completed_with_errors' : 'completed',
          records_imported: recordsImported,
          records_failed: recordsFailed,
          error_log: errorLog.length > 0 ? errorLog : null,
        })
        .eq('file_name', operationId);

      console.log(`Import completed: ${recordsImported} imported, ${recordsFailed} failed`);

      return new Response(
        JSON.stringify({
          success: true,
          records_imported: recordsImported,
          records_failed: recordsFailed,
          errors: errorLog.slice(0, 100),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: start, check, or process' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Bulk import error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
