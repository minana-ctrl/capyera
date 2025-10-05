-- Remove unique constraint on order_number (we already have a unique constraint on shopify_order_id)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_number_key;