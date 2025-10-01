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

    console.log('Starting Shopify order import...');

    // Create import log entry
    const { data: importLog, error: logError } = await supabase
      .from('import_logs')
      .insert({
        import_type: 'shopify_orders',
        status: 'in_progress',
        file_name: 'shopify_api_import'
      })
      .select()
      .single();

    if (logError) throw logError;

    // Calculate date 2 years ago
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const createdAtMin = twoYearsAgo.toISOString();

    let recordsImported = 0;
    let recordsFailed = 0;
    const errorLog: any[] = [];
    let hasNextPage = true;
    let pageInfo = null;

    while (hasNextPage) {
      // Build Shopify API URL
      let url = `https://${shopifyDomain}/admin/api/2024-01/orders.json?status=any&created_at_min=${createdAtMin}&limit=250`;
      if (pageInfo) {
        url += `&page_info=${pageInfo}`;
      }

      console.log(`Fetching orders from Shopify: ${url}`);

      const shopifyResponse = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
      });

      if (!shopifyResponse.ok) {
        throw new Error(`Shopify API error: ${shopifyResponse.status} ${await shopifyResponse.text()}`);
      }

      const data = await shopifyResponse.json();
      const orders = data.orders || [];

      console.log(`Processing ${orders.length} orders...`);

      // Process each order
      for (const shopifyOrder of orders) {
        try {
          // Determine if customer is new (first order)
          const customerOrders = shopifyOrder.customer?.orders_count || 0;
          const isNewCustomer = customerOrders === 1;

          // Insert order
          const { data: insertedOrder, error: orderError } = await supabase
            .from('orders')
            .insert({
              shopify_order_id: shopifyOrder.id.toString(),
              order_number: shopifyOrder.order_number?.toString() || shopifyOrder.name,
              status: shopifyOrder.financial_status || 'pending',
              fulfillment_status: shopifyOrder.fulfillment_status || 'unfulfilled',
              customer_name: shopifyOrder.customer ? `${shopifyOrder.customer.first_name || ''} ${shopifyOrder.customer.last_name || ''}`.trim() : 'Guest',
              customer_email: shopifyOrder.customer?.email || shopifyOrder.email,
              total_amount: parseFloat(shopifyOrder.total_price || '0'),
              product_revenue: parseFloat(shopifyOrder.subtotal_price || '0'),
              shipping_cost: parseFloat(shopifyOrder.total_shipping_price_set?.shop_money?.amount || '0'),
              currency: shopifyOrder.currency || 'USD',
              placed_at: new Date(shopifyOrder.created_at),
              fulfilled_at: shopifyOrder.fulfillment_status === 'fulfilled' ? new Date(shopifyOrder.updated_at) : null,
              cancelled_at: shopifyOrder.cancelled_at ? new Date(shopifyOrder.cancelled_at) : null,
              is_new_customer: isNewCustomer,
              shipping_address: shopifyOrder.shipping_address || {},
              country_code: shopifyOrder.shipping_address?.country_code || null,
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
          for (const item of shopifyOrder.line_items || []) {
            const { error: itemError } = await supabase
              .from('order_line_items')
              .insert({
                order_id: insertedOrder.id,
                sku: item.sku || item.variant_id?.toString() || 'UNKNOWN',
                product_name: item.name,
                quantity: item.quantity,
                unit_price: parseFloat(item.price),
                total_price: parseFloat(item.price) * item.quantity,
                product_id: null, // Will need to match by SKU later
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

      // Check for next page
      const linkHeader = shopifyResponse.headers.get('Link');
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&]+)[^>]*>;\s*rel="next"/);
        pageInfo = nextMatch ? nextMatch[1] : null;
        hasNextPage = !!pageInfo;
      } else {
        hasNextPage = false;
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
      .eq('id', importLog.id);

    console.log(`Import completed: ${recordsImported} imported, ${recordsFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        records_imported: recordsImported,
        records_failed: recordsFailed,
        errors: errorLog,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
