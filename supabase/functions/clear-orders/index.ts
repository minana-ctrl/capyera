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

    console.log('Starting to clear all orders and line items...');

    // Delete order line items first (child records)
    const { error: lineItemsError } = await supabaseClient
      .from('order_line_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (lineItemsError) {
      console.error('Error deleting line items:', lineItemsError);
      throw lineItemsError;
    }

    console.log('✓ Cleared all order line items');

    // Delete orders (parent records)
    const { error: ordersError } = await supabaseClient
      .from('orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (ordersError) {
      console.error('Error deleting orders:', ordersError);
      throw ordersError;
    }

    console.log('✓ Cleared all orders');

    // Delete daily sales summary
    const { error: summaryError } = await supabaseClient
      .from('daily_sales_summary')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (summaryError) {
      console.error('Error deleting daily sales summary:', summaryError);
      throw summaryError;
    }

    console.log('✓ Cleared daily sales summary');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'All orders, line items, and sales summary cleared successfully' 
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
