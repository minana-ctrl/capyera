import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain',
};

async function verifyShopifyWebhook(body: string, hmacHeader: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  
  return signatureBase64 === hmacHeader;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get webhook topic and verify signature
    const topic = req.headers.get('x-shopify-topic');
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const shopDomain = req.headers.get('x-shopify-shop-domain');

    const bodyText = await req.text();
    
    // Verify webhook signature
    if (hmacHeader && !(await verifyShopifyWebhook(bodyText, hmacHeader, shopifyToken))) {
      console.error('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const order = JSON.parse(bodyText);
    console.log(`Processing webhook: ${topic} for order ${order.name}`);

    // Handle different webhook topics
    switch (topic) {
      case 'orders/create':
        await handleOrderCreate(supabase, order);
        break;
      case 'orders/fulfilled':
        await handleOrderFulfilled(supabase, order);
        break;
      case 'orders/cancelled':
        await handleOrderCancelled(supabase, order);
        break;
      case 'orders/updated':
        await handleOrderUpdated(supabase, order);
        break;
      default:
        console.log(`Unhandled topic: ${topic}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleOrderCreate(supabase: any, shopifyOrder: any) {
  console.log('Creating order and reserving inventory...');

  // Determine if customer is new
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
      is_new_customer: isNewCustomer,
      shipping_address: shopifyOrder.shipping_address || {},
      country_code: shopifyOrder.shipping_address?.country_code || null,
    })
    .select()
    .single();

  if (orderError) {
    console.error('Error inserting order:', orderError);
    throw orderError;
  }

  // Insert line items and reserve inventory
  for (const item of shopifyOrder.line_items || []) {
    const sku = item.sku || item.variant_id?.toString();

    // Find product by SKU
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('sku', sku)
      .single();

    // Insert line item
    await supabase
      .from('order_line_items')
      .insert({
        order_id: insertedOrder.id,
        sku: sku || 'UNKNOWN',
        product_name: item.name,
        quantity: item.quantity,
        unit_price: parseFloat(item.price),
        total_price: parseFloat(item.price) * item.quantity,
        product_id: product?.id || null,
        bundle_id: null,
      });

    // Reserve inventory if product exists
    if (product) {
      const { error: reserveError } = await supabase.rpc('reserve_inventory', {
        p_product_id: product.id,
        p_quantity: item.quantity,
      });

      if (reserveError) {
        console.error('Error reserving inventory:', reserveError);
      } else {
        console.log(`Reserved ${item.quantity} units of ${sku}`);
      }
    }
  }
}

async function handleOrderFulfilled(supabase: any, shopifyOrder: any) {
  console.log('Fulfilling order and deducting inventory...');

  // Update order status
  const { data: order, error: updateError } = await supabase
    .from('orders')
    .update({
      fulfillment_status: 'fulfilled',
      fulfilled_at: new Date(),
    })
    .eq('shopify_order_id', shopifyOrder.id.toString())
    .select()
    .single();

  if (updateError) {
    console.error('Error updating order:', updateError);
    throw updateError;
  }

  // Get line items
  const { data: lineItems } = await supabase
    .from('order_line_items')
    .select('*')
    .eq('order_id', order.id);

  // Deduct inventory (release reservation and reduce quantity)
  for (const item of lineItems || []) {
    if (item.product_id) {
      const { error: deductError } = await supabase.rpc('deduct_inventory', {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });

      if (deductError) {
        console.error('Error deducting inventory:', deductError);
      } else {
        console.log(`Deducted ${item.quantity} units of ${item.sku}`);
      }
    }
  }
}

async function handleOrderCancelled(supabase: any, shopifyOrder: any) {
  console.log('Cancelling order and releasing inventory...');

  // Update order status
  const { data: order, error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date(),
    })
    .eq('shopify_order_id', shopifyOrder.id.toString())
    .select()
    .single();

  if (updateError) {
    console.error('Error updating order:', updateError);
    throw updateError;
  }

  // Get line items
  const { data: lineItems } = await supabase
    .from('order_line_items')
    .select('*')
    .eq('order_id', order.id);

  // Release reserved inventory
  for (const item of lineItems || []) {
    if (item.product_id) {
      const { error: releaseError } = await supabase.rpc('release_inventory', {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });

      if (releaseError) {
        console.error('Error releasing inventory:', releaseError);
      } else {
        console.log(`Released ${item.quantity} units of ${item.sku}`);
      }
    }
  }
}

async function handleOrderUpdated(supabase: any, shopifyOrder: any) {
  console.log('Updating order status...');

  await supabase
    .from('orders')
    .update({
      status: shopifyOrder.financial_status || 'pending',
      fulfillment_status: shopifyOrder.fulfillment_status || 'unfulfilled',
      total_amount: parseFloat(shopifyOrder.total_price || '0'),
      product_revenue: parseFloat(shopifyOrder.subtotal_price || '0'),
      shipping_cost: parseFloat(shopifyOrder.total_shipping_price_set?.shop_money?.amount || '0'),
    })
    .eq('shopify_order_id', shopifyOrder.id.toString());
}
