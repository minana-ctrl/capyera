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

    // Delete in batches to avoid timeout
    console.log('Deleting order line items in batches...');
    let totalDeleted = 0;
    let batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      // Fetch a batch of IDs
      const { data: items, error: fetchError } = await supabaseClient
        .from('order_line_items')
        .select('id')
        .limit(batchSize);
      
      if (fetchError) {
        console.error('Fetch error:', fetchError);
        throw fetchError;
      }
      
      if (!items || items.length === 0) {
        hasMore = false;
        break;
      }
      
      // Delete this batch
      const ids = items.map(item => item.id);
      const { error: deleteError } = await supabaseClient
        .from('order_line_items')
        .delete()
        .in('id', ids);
      
      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }
      
      totalDeleted += items.length;
      console.log(`Deleted ${totalDeleted} line items...`);
      
      hasMore = items.length === batchSize;
    }
    
    console.log(`✓ Cleared ${totalDeleted} order line items`);
    
    // Delete orders in batches
    console.log('Deleting orders in batches...');
    totalDeleted = 0;
    hasMore = true;
    
    while (hasMore) {
      // Fetch a batch of IDs
      const { data: orders, error: fetchError } = await supabaseClient
        .from('orders')
        .select('id')
        .limit(batchSize);
      
      if (fetchError) {
        console.error('Fetch error:', fetchError);
        throw fetchError;
      }
      
      if (!orders || orders.length === 0) {
        hasMore = false;
        break;
      }
      
      // Delete this batch
      const ids = orders.map(order => order.id);
      const { error: deleteError } = await supabaseClient
        .from('orders')
        .delete()
        .in('id', ids);
      
      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }
      
      totalDeleted += orders.length;
      console.log(`Deleted ${totalDeleted} orders...`);
      
      hasMore = orders.length === batchSize;
    }
    
    console.log(`✓ Cleared ${totalDeleted} orders`);
    
    // Delete daily sales summary (should be small)
    const { error: summaryError } = await supabaseClient
      .from('daily_sales_summary')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

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
