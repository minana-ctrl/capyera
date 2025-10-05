-- Ensure unique order numbers for upsert to work
ALTER TABLE public.orders
ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);