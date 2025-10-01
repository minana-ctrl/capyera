-- Add unique constraint to order_line_items to prevent duplicate line items per order
ALTER TABLE order_line_items 
ADD CONSTRAINT order_line_items_order_id_sku_key UNIQUE (order_id, sku);