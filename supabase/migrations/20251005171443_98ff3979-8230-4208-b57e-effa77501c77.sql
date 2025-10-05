-- Add indexes to improve order query performance
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON orders(placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_line_items_order_id ON order_line_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Add index on product_id for line items to speed up product lookups
CREATE INDEX IF NOT EXISTS idx_order_line_items_product_id ON order_line_items(product_id);

-- Add composite index for common date range queries
CREATE INDEX IF NOT EXISTS idx_orders_placed_at_status ON orders(placed_at DESC, status);