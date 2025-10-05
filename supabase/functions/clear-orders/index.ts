import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Clearing all orders via direct SQL...');

    // Use a simple approach: just keep deleting batches until nothing's left
    // Start with line items
    let lineItemsDeleted = 0;
    while (true) {
      const { error, count } = await supabaseClient
        .from('order_line_items')
        .delete()
        .limit(500);
      
      if (error) {
        console.error('Error deleting line items:', error);
        break;
      }
      
      lineItemsDeleted += count || 0;
      console.log(`Deleted ${lineItemsDeleted} line items so far...`);
      
      if (!count || count === 0) break;
    }

    // Then orders
    let ordersDeleted = 0;
    while (true) {
      const { error, count } = await supabaseClient
        .from('orders')
        .delete()
        .limit(500);
      
      if (error) {
        console.error('Error deleting orders:', error);
        break;
      }
      
      ordersDeleted += count || 0;
      console.log(`Deleted ${ordersDeleted} orders so far...`);
      
      if (!count || count === 0) break;
    }

    // Clear summary
    await supabaseClient
      .from('daily_sales_summary')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    console.log(`✓ Cleared ${lineItemsDeleted} line items, ${ordersDeleted} orders`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleared ${ordersDeleted} orders and ${lineItemsDeleted} line items` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );


  } catch (error) {
    console.error('Clear orders error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
