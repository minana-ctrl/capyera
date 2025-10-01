-- Remove the unique constraint from order_line_items
ALTER TABLE order_line_items 
DROP CONSTRAINT IF EXISTS order_line_items_order_id_sku_key;