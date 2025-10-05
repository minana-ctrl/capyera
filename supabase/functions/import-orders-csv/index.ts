import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { csvData, clearData } = await req.json();

    if (clearData && (!csvData || csvData.length === 0)) {
      console.log('Clearing existing data in background...');
      // Run clears in background to avoid request timeouts/compute limits
      // deno-lint-ignore no-explicit-any
      (globalThis as any).EdgeRuntime?.waitUntil((async () => {
        await supabaseClient.from('order_line_items').delete().not('id', 'is', null);
        await supabaseClient.from('orders').delete().not('id', 'is', null);
        await supabaseClient.from('daily_sales_summary').delete().not('id', 'is', null);
        console.log('Data cleared successfully (background)');
      })());

      return new Response(
        JSON.stringify({ success: true, message: 'Clear started' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (clearData) {
      console.log('Clearing existing data...');
      await supabaseClient.from('order_line_items').delete().not('id', 'is', null);
      await supabaseClient.from('orders').delete().not('id', 'is', null);
      await supabaseClient.from('daily_sales_summary').delete().not('id', 'is', null);
      console.log('Data cleared successfully');
    }

    if (!csvData || csvData.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Data cleared' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${csvData.length} CSV files...`);
    
    let totalOrdersImported = 0;
    let totalLineItemsImported = 0;
    const batchSize = 50; // Smaller batches to reduce memory

    // Process one CSV at a time to reduce memory usage
    for (let csvIndex = 0; csvIndex < csvData.length; csvIndex++) {
      const csv = csvData[csvIndex];
      console.log(`Processing CSV ${csvIndex + 1}/${csvData.length}...`);
      
      const orders = new Map<string, any>();
      const lineItems: any[] = [];
      
      const lines = csv.split('\n');
      const headers = lines[0].split(',').map((h: string) => h.trim());
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) continue;
        
        const row: any = {};
        headers.forEach((header: string, idx: number) => {
          row[header] = values[idx];
        });

        const orderNumber = row['Name'];
        if (!orderNumber) continue;

        if (!orders.has(orderNumber)) {
          const placedAt = row['Created at'] ? new Date(row['Created at']).toISOString() : new Date().toISOString();
          const fulfilledAt = row['Fulfilled at'] && row['Fulfilled at'].trim() 
            ? new Date(row['Fulfilled at']).toISOString() 
            : null;
          
          const orderData = {
            order_number: orderNumber.replace('#', ''),
            shopify_order_id: row['Id']?.toString() || null,
            customer_email: row['Email'] || null,
            customer_name: row['Billing Name'] || row['Shipping Name'] || null,
            status: row['Financial Status']?.toLowerCase() === 'paid' ? 'completed' : 'pending',
            fulfillment_status: row['Fulfillment Status']?.toLowerCase() || 'unfulfilled',
            placed_at: placedAt,
            fulfilled_at: fulfilledAt,
            total_amount: parseFloat(row['Total']) || 0,
            product_revenue: parseFloat(row['Subtotal']) || 0,
            shipping_cost: parseFloat(row['Shipping']) || 0,
            currency: row['Currency'] || 'USD',
            country_code: row['Billing Country'] || null,
          };
          
          console.log(`Order ${orderNumber}: shopify_id=${orderData.shopify_order_id}, country=${orderData.country_code}, fulfilled_at=${orderData.fulfilled_at}`);
          orders.set(orderNumber, orderData);
        }

        if (row['Lineitem name'] && row['Lineitem name'].trim()) {
          lineItems.push({
            order_number: orderNumber.replace('#', ''),
            product_name: row['Lineitem name'],
            sku: row['Lineitem sku'] || '',
            quantity: parseInt(row['Lineitem quantity']) || 1,
            unit_price: parseFloat(row['Lineitem price']) || 0,
            total_price: parseFloat(row['Lineitem price']) * (parseInt(row['Lineitem quantity']) || 1),
          });
        }
      }

      // Insert orders for this CSV
      const ordersArray = Array.from(orders.values());
      console.log(`Inserting ${ordersArray.length} orders from CSV ${csvIndex + 1}...`);
      
      let insertedOrderIds: any[] = [];
      
      for (let i = 0; i < ordersArray.length; i += batchSize) {
        const batch = ordersArray.slice(i, i + batchSize);
        const { data, error } = await supabaseClient.from('orders').upsert(batch, {
          onConflict: 'order_number',
          ignoreDuplicates: false
        }).select('id, order_number');
        
        if (error) {
          console.error('Error inserting orders batch:', error);
        } else if (data) {
          insertedOrderIds.push(...data);
          console.log(`✓ Inserted ${data.length} orders in batch`);
        }
      }

      console.log(`Total orders inserted: ${insertedOrderIds.length}`);
      const orderIdMap = new Map(insertedOrderIds.map(o => [o.order_number, o.id]));

      // Map and insert line items
      const lineItemsWithIds = lineItems
        .map(item => ({
          ...item,
          order_id: orderIdMap.get(item.order_number),
        }))
        .filter(item => item.order_id);

      console.log(`Inserting ${lineItemsWithIds.length} line items from CSV ${csvIndex + 1}...`);
      
      if (lineItemsWithIds.length === 0) {
        console.warn('⚠️ No line items to insert. This might indicate a parsing issue.');
        console.log('Sample order numbers from orders:', Array.from(orders.keys()).slice(0, 3));
        console.log('Sample order numbers from lineItems:', lineItems.slice(0, 3).map(li => li.order_number));
      }
      
      for (let i = 0; i < lineItemsWithIds.length; i += batchSize) {
        const batch = lineItemsWithIds.slice(i, i + batchSize);
        const { error } = await supabaseClient.from('order_line_items').insert(
          batch.map(({ order_number, ...rest }) => rest)
        );
        if (error) {
          console.error('Error inserting line items batch:', error);
        } else {
          console.log(`✓ Inserted ${batch.length} line items in batch`);
        }
      }

      totalOrdersImported += orders.size;
      totalLineItemsImported += lineItemsWithIds.length;

      // Clear memory
      orders.clear();
      lineItems.length = 0;
      
      console.log(`Completed CSV ${csvIndex + 1}/${csvData.length}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ordersImported: totalOrdersImported,
        lineItemsImported: totalLineItemsImported,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}
