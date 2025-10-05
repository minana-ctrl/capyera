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
    let totalRowsProcessed = 0;
    let totalRowsSkipped = 0;
    let totalOrdersFailed = 0;
    let totalLineItemsFailed = 0;
    const batchSize = 50;

    for (let csvIndex = 0; csvIndex < csvData.length; csvIndex++) {
      const csv = csvData[csvIndex];
      console.log(`Processing CSV ${csvIndex + 1}/${csvData.length}...`);
      
      const orders = new Map<string, any>();
      const lineItems: any[] = [];
      
      try {
        const rows = parseCSV(csv);
        if (rows.length === 0) {
          console.warn(`CSV ${csvIndex + 1} is empty, skipping`);
          continue;
        }
        
        const headers = rows[0];
        console.log(`Found ${headers.length} columns, ${rows.length - 1} rows`);
        
        const requiredHeaders = ['Name', 'Email', 'Created at'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          console.error(`CSV ${csvIndex + 1} missing required headers: ${missingHeaders.join(', ')}`);
          continue;
        }
        
        for (let i = 1; i < rows.length; i++) {
          totalRowsProcessed++;
          const values = rows[i];
          
          try {
            if (values.length !== headers.length) {
              if (values.length < 10) {
                totalRowsSkipped++;
                continue;
              }
              
              while (values.length < headers.length) {
                values.push('');
              }
              if (values.length > headers.length) {
                values.length = headers.length;
              }
            }
            
            const row: any = {};
            headers.forEach((header: string, idx: number) => {
              row[header] = values[idx] || '';
            });

            const orderNumber = row['Name'];
            if (!orderNumber || !orderNumber.trim()) {
              totalRowsSkipped++;
              continue;
            }

            if (!orders.has(orderNumber) && row['Financial Status']) {
              try {
                const placedAt = row['Created at'] ? new Date(row['Created at']).toISOString() : new Date().toISOString();
                const fulfilledAt = row['Fulfilled at'] && row['Fulfilled at'].trim() 
                  ? new Date(row['Fulfilled at']).toISOString() 
                  : null;
                
                const orderData: any = {
                  order_number: orderNumber.replace('#', ''),
                  shopify_order_id: row['Id']?.toString() || null,
                  customer_email: row['Email'] || null,
                  customer_name: row['Billing Name'] || row['Shipping Name'] || null,
                  status: (row['Financial Status'] || 'pending').toLowerCase(),
                  fulfillment_status: (row['Fulfillment Status'] || 'unfulfilled').toLowerCase(),
                  total_amount: parseFloat(row['Total']) || 0,
                  product_revenue: parseFloat(row['Subtotal']) || 0,
                  shipping_cost: parseFloat(row['Shipping']) || 0,
                  currency: row['Currency'] || 'USD',
                  country_code: row['Shipping Country'] || row['Billing Country'] || null,
                  placed_at: placedAt,
                  fulfilled_at: fulfilledAt,
                  cancelled_at: row['Cancelled at'] && row['Cancelled at'].trim() ? new Date(row['Cancelled at']).toISOString() : null,
                  is_new_customer: null,
                  shipping_address: null,
                };

                if (row['Shipping Name'] || row['Shipping Address1']) {
                  try {
                    orderData.shipping_address = {
                      name: row['Shipping Name'] || null,
                      address1: row['Shipping Address1'] || null,
                      address2: row['Shipping Address2'] || null,
                      city: row['Shipping City'] || null,
                      province: row['Shipping Province'] || null,
                      province_code: row['Shipping Province'] || null,
                      zip: row['Shipping Zip'] || null,
                      country: row['Shipping Country'] || null,
                      country_code: row['Shipping Country'] || null,
                      phone: row['Shipping Phone'] || null,
                    };
                  } catch (addrError) {
                    console.warn(`Row ${i}: Failed to build shipping address`);
                  }
                }

                orders.set(orderNumber, orderData);
              } catch (orderError) {
                totalOrdersFailed++;
                console.error(`Row ${i}: Failed to parse order ${orderNumber}`);
              }
            }

            if (row['Lineitem name']) {
              try {
                const lineItemData = {
                  order_number: orderNumber.replace('#', ''),
                  product_name: row['Lineitem name'],
                  sku: row['Lineitem sku'] || '',
                  quantity: parseInt(row['Lineitem quantity']) || 0,
                  unit_price: parseFloat(row['Lineitem price']) || 0,
                  total_price: parseFloat(row['Lineitem price']) * (parseInt(row['Lineitem quantity']) || 0),
                };
                
                if (lineItemData.quantity > 0) {
                  lineItems.push(lineItemData);
                }
              } catch (itemError) {
                totalLineItemsFailed++;
                console.error(`Row ${i}: Failed to parse line item`);
              }
            }
          } catch (rowError) {
            totalRowsSkipped++;
            console.error(`Row ${i}: Unexpected error`);
          }
        }

        console.log(`CSV ${csvIndex + 1}: Extracted ${orders.size} orders, ${lineItems.length} line items`);

        // Batch insert orders
        const orderArray = Array.from(orders.values());
        for (let i = 0; i < orderArray.length; i += batchSize) {
          const batch = orderArray.slice(i, i + batchSize);
          try {
            const { data: insertedOrders, error } = await supabaseClient
              .from('orders')
              .upsert(batch, { onConflict: 'order_number' })
              .select('id, order_number');

            if (error) {
              console.error(`Failed to insert orders batch:`, error.message);
              totalOrdersFailed += batch.length;
            } else {
              console.log(`✓ Inserted ${batch.length} orders in batch`);
              totalOrdersImported += insertedOrders?.length || 0;
            }
          } catch (batchError) {
            console.error(`Exception inserting orders batch`);
            totalOrdersFailed += batch.length;
          }
        }

        // Fetch order IDs
        const orderIdMap = new Map<string, string>();
        try {
          const { data: ordersFromDB } = await supabaseClient
            .from('orders')
            .select('id, order_number')
            .in('order_number', Array.from(orders.keys()).map(k => k.replace('#', '')));

          if (ordersFromDB) {
            ordersFromDB.forEach((o: any) => {
              orderIdMap.set(o.order_number, o.id);
              orderIdMap.set('#' + o.order_number, o.id);
            });
          }
        } catch (fetchError) {
          console.error('Failed to fetch order IDs');
        }

        // Fetch products for SKU mapping
        console.log('Fetching products for SKU mapping...');
        const productSkuMap = new Map<string, string>();
        try {
          const { data: products } = await supabaseClient
            .from('products')
            .select('id, sku');
          
          if (products) {
            products.forEach((p: any) => {
              if (p.sku) {
                productSkuMap.set(p.sku.trim().toLowerCase(), p.id);
              }
            });
            console.log(`Loaded ${productSkuMap.size} products for SKU matching`);
          }
        } catch (productError) {
          console.error('Exception fetching products');
        }

        // Map and insert line items
        const lineItemsWithIds = lineItems
          .map(item => {
            try {
              const orderNum = String(item.order_number).trim();
              const orderId = orderIdMap.get(orderNum) || orderIdMap.get('#' + orderNum);
              const productId = item.sku ? productSkuMap.get(item.sku.trim().toLowerCase()) : null;
              
              return {
                ...item,
                order_number: orderNum,
                order_id: orderId,
                product_id: productId || null,
              };
            } catch (mapError) {
              return null;
            }
          })
          .filter(item => item && item.order_id);

        console.log(`Line items: ${lineItems.length} total, ${lineItemsWithIds.length} linked`);
        
        const linkedToProducts = lineItemsWithIds.filter(li => li.product_id).length;
        console.log(`Linked to products: ${linkedToProducts}/${lineItemsWithIds.length}`);
        
        if (lineItemsWithIds.length < lineItems.length) {
          console.warn(`⚠️ ${lineItems.length - lineItemsWithIds.length} line items couldn't be linked`);
        }

        console.log(`Inserting ${lineItemsWithIds.length} line items...`);
        for (let i = 0; i < lineItemsWithIds.length; i += batchSize) {
          const batch = lineItemsWithIds.slice(i, i + batchSize);
          try {
            const { error } = await supabaseClient
              .from('order_line_items')
              .insert(batch);

            if (error) {
              console.error(`Failed to insert line items:`, error.message);
              totalLineItemsFailed += batch.length;
            } else {
              console.log(`✓ Inserted ${batch.length} line items`);
              totalLineItemsImported += batch.length;
            }
          } catch (itemBatchError) {
            console.error(`Exception inserting line items`);
            totalLineItemsFailed += batch.length;
          }
        }
      } catch (csvError) {
        console.error(`Failed to process CSV ${csvIndex + 1}:`, csvError);
      }
    }

    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Rows processed: ${totalRowsProcessed}`);
    console.log(`Rows skipped: ${totalRowsSkipped}`);
    console.log(`Orders imported: ${totalOrdersImported}`);
    console.log(`Orders failed: ${totalOrdersFailed}`);
    console.log(`Line items imported: ${totalLineItemsImported}`);
    console.log(`Line items failed: ${totalLineItemsFailed}`);
    console.log('=====================\n');

    return new Response(
      JSON.stringify({ 
        success: true, 
        ordersImported: totalOrdersImported,
        lineItemsImported: totalLineItemsImported,
        rowsProcessed: totalRowsProcessed,
        rowsSkipped: totalRowsSkipped,
        ordersFailed: totalOrdersFailed,
        lineItemsFailed: totalLineItemsFailed
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

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i++;
      } else if (inQuotes && (nextChar === ',' || nextChar === '\n' || nextChar === '\r' || nextChar === undefined)) {
        inQuotes = false;
      } else if (!inQuotes && field.length === 0) {
        inQuotes = true;
      } else {
        field += char;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(field);
      
      if (row.some(f => f.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some(f => f.length > 0)) {
      rows.push(row);
    }
  }
  
  return rows;
}
