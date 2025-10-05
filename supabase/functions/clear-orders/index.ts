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

    // Delete using time windows to avoid huge URLs and timeouts
    async function deleteByDateWindows(table: string, windowHours = 12) {
      // Oldest row
      const { data: oldestRows, error: oldestErr } = await supabaseClient
        .from(table)
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1);
      if (oldestErr) throw oldestErr;
      const oldest = oldestRows?.[0]?.created_at as string | undefined;
      if (!oldest) return; // nothing to delete

      // Newest row
      const { data: newestRows, error: newestErr } = await supabaseClient
        .from(table)
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);
      if (newestErr) throw newestErr;
      const newest = newestRows?.[0]?.created_at as string | undefined;
      if (!newest) return;

      let start = new Date(oldest);
      const end = new Date(newest);
      const stepMs = windowHours * 60 * 60 * 1000;

      while (start <= end) {
        const next = new Date(start.getTime() + stepMs);
        const { error } = await supabaseClient
          .from(table)
          .delete()
          .gte('created_at', start.toISOString())
          .lt('created_at', next.toISOString());
        if (error) {
          console.error(`Delete window error on ${table}:`, error);
          throw error;
        }
        console.log(`Deleted ${table} window: ${start.toISOString()} -> ${next.toISOString()}`);
        start = next;
      }
    }

    async function clearAll() {
      console.log('Starting to clear all orders and line items...');
      console.log('Deleting order_line_items by windows...');
      await deleteByDateWindows('order_line_items', 12);
      console.log('✓ Cleared order line items');
      console.log('Deleting orders by windows...');
      await deleteByDateWindows('orders', 12);
      console.log('✓ Cleared orders');

      // Daily sales summary is small
      const { error: summaryError } = await supabaseClient
        .from('daily_sales_summary')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (summaryError) {
        console.error('Error deleting daily sales summary:', summaryError);
        throw summaryError;
      }
      console.log('✓ Cleared daily sales summary');
    }

    const EdgeRt: any = (globalThis as any).EdgeRuntime;
    if (EdgeRt && typeof EdgeRt.waitUntil === 'function') {
      // Run in background to avoid client timeouts
      EdgeRt.waitUntil(clearAll());
      return new Response(
        JSON.stringify({ started: true, message: 'Clearing orders in background' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
      );
    } else {
      // Fallback: run synchronously
      await clearAll();
      return new Response(
        JSON.stringify({ success: true, message: 'All orders cleared' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }


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
