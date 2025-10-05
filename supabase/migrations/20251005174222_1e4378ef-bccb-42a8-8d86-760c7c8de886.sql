-- Immediate full reset of orders and related tables
TRUNCATE TABLE public.order_line_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.daily_sales_summary RESTART IDENTITY CASCADE;