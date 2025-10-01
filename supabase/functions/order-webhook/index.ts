import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("=== Webhook Received ===");
    const body = await req.json();
    console.log("Event:", body.event);
    console.log("Batch:", body.batchNumber, "Orders:", body.orderCount);
    
    if (body.event === 'shopify_batch_fetched' && body.orders) {
      let imported = 0;
      let failed = 0;

      for (const order of body.orders) {
        try {
          // Extract order number from name (e.g., "#CPY73016" -> "CPY73016")
          const orderNumber = order.name.replace('#', '');
          
          // Insert/update order
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .upsert({
              shopify_order_id: order.id,
              order_number: orderNumber,
              status: 'paid',
              fulfillment_status: order.displayFulfillmentStatus?.toLowerCase() || 'unfulfilled',
              total_amount: parseFloat(order.totalPriceSet?.shopMoney?.amount || 0),
              shipping_cost: parseFloat(order.totalShippingPriceSet?.shopMoney?.amount || 0),
              product_revenue: parseFloat(order.totalPriceSet?.shopMoney?.amount || 0) - parseFloat(order.totalShippingPriceSet?.shopMoney?.amount || 0),
              currency: order.totalPriceSet?.shopMoney?.currencyCode || 'USD',
              country_code: order.shippingAddress?.countryCode,
              customer_email: order.customer?.email || order.email,
              customer_name: order.customer?.displayName || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || order.billingAddress?.name,
              shipping_address: order.shippingAddress,
              is_new_customer: order.customer?.numberOfOrders === '1',
              placed_at: order.createdAt,
              fulfilled_at: order.displayFulfillmentStatus?.toLowerCase() === 'fulfilled' ? order.updatedAt : null,
              cancelled_at: order.cancelledAt,
              updated_at: order.updatedAt,
            }, {
              onConflict: 'order_number',
              ignoreDuplicates: false
            })
            .select()
            .single();

          if (orderError) {
            console.error("Error inserting order:", orderNumber, orderError);
            failed++;
            continue;
          }

          // Insert line items
          if (order.lineItems?.edges) {
            for (const edge of order.lineItems.edges) {
              const item = edge.node;
              
              // Find product by SKU
              const { data: product } = await supabase
                .from('products')
                .select('id, name, unit_price')
                .eq('sku', item.sku)
                .maybeSingle();

              if (product) {
                await supabase
                  .from('order_line_items')
                  .upsert({
                    order_id: orderData.id,
                    product_id: product.id,
                    sku: item.sku,
                    product_name: product.name,
                    quantity: item.quantity,
                    unit_price: product.unit_price,
                    total_price: product.unit_price * item.quantity,
                  }, {
                    onConflict: 'order_id,sku',
                    ignoreDuplicates: false
                  });
              } else {
                // Product not found - still insert line item with SKU for reference
                console.warn(`Product not found for SKU: ${item.sku}`);
                await supabase
                  .from('order_line_items')
                  .upsert({
                    order_id: orderData.id,
                    product_id: null,
                    sku: item.sku,
                    product_name: `Unknown Product (${item.sku})`,
                    quantity: item.quantity,
                    unit_price: 0,
                    total_price: 0,
                  }, {
                    onConflict: 'order_id,sku',
                    ignoreDuplicates: false
                  });
              }
            }
          }

          imported++;
          console.log(`✓ Imported order ${orderNumber}`);
        } catch (err) {
          console.error("Error processing order:", err);
          failed++;
        }
      }

      console.log(`=== Batch Complete: ${imported} imported, ${failed} failed ===`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Orders processed",
          imported,
          failed
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Just acknowledge other events
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook received",
        event: body.event
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
