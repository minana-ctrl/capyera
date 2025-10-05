-- Wipe Shopify orders-related data (handle FKs)
BEGIN;
TRUNCATE TABLE public.order_line_items, public.orders, public.daily_sales_summary RESTART IDENTITY CASCADE;
COMMIT;