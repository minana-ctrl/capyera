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

    if (clearData) {
      console.log('Clearing existing data...');
      await supabaseClient.from('daily_sales_summary').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabaseClient.from('order_line_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabaseClient.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      console.log('Data cleared successfully');
    }

    if (!csvData || csvData.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Data cleared' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${csvData.length} CSV files...`);
    
    const orders = new Map<string, any>();
    const lineItems: any[] = [];
    let processedRows = 0;

    for (const csv of csvData) {
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

        // First row of order contains all order details
        if (!orders.has(orderNumber)) {
          const placedAt = row['Created at'] ? new Date(row['Created at']).toISOString() : new Date().toISOString();
          
          orders.set(orderNumber, {
            order_number: orderNumber.replace('#', ''),
            shopify_order_id: row['Id'] || null,
            customer_email: row['Email'] || null,
            customer_name: row['Billing Name'] || row['Shipping Name'] || null,
            status: row['Financial Status']?.toLowerCase() === 'paid' ? 'completed' : 'pending',
            fulfillment_status: row['Fulfillment Status']?.toLowerCase() || 'unfulfilled',
            placed_at: placedAt,
            fulfilled_at: row['Fulfilled at'] ? new Date(row['Fulfilled at']).toISOString() : null,
            total_amount: parseFloat(row['Total']) || 0,
            product_revenue: parseFloat(row['Subtotal']) || 0,
            shipping_cost: parseFloat(row['Shipping']) || 0,
            currency: row['Currency'] || 'USD',
            country_code: row['Billing Country'] || null,
          });
        }

        // Add line item if present
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

        processedRows++;
        if (processedRows % 1000 === 0) {
          console.log(`Processed ${processedRows} rows...`);
        }
      }
    }

    console.log(`Importing ${orders.size} orders...`);
    const ordersArray = Array.from(orders.values());
    
    // Insert orders in batches
    const batchSize = 100;
    for (let i = 0; i < ordersArray.length; i += batchSize) {
      const batch = ordersArray.slice(i, i + batchSize);
      const { error } = await supabaseClient.from('orders').insert(batch);
      if (error) {
        console.error('Error inserting orders batch:', error);
      }
    }

    // Get order IDs
    const { data: insertedOrders } = await supabaseClient
      .from('orders')
      .select('id, order_number');

    const orderIdMap = new Map(insertedOrders?.map(o => [o.order_number, o.id]) || []);

    // Map line items to order IDs
    const lineItemsWithIds = lineItems
      .map(item => ({
        ...item,
        order_id: orderIdMap.get(item.order_number),
      }))
      .filter(item => item.order_id);

    console.log(`Importing ${lineItemsWithIds.length} line items...`);
    
    // Insert line items in batches
    for (let i = 0; i < lineItemsWithIds.length; i += batchSize) {
      const batch = lineItemsWithIds.slice(i, i + batchSize);
      const { error } = await supabaseClient.from('order_line_items').insert(
        batch.map(({ order_number, ...rest }) => rest)
      );
      if (error) {
        console.error('Error inserting line items batch:', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ordersImported: orders.size,
        lineItemsImported: lineItemsWithIds.length,
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
