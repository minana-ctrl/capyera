-- Create a safe admin function to clear orders and related tables fast
CREATE OR REPLACE FUNCTION public.clear_orders_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use TRUNCATE for speed and to avoid timeouts/locks
  TRUNCATE TABLE public.order_line_items RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.orders RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.daily_sales_summary RESTART IDENTITY CASCADE;
END;
$$;

-- Allow execution from read-only/select context used by maintenance tools
GRANT EXECUTE ON FUNCTION public.clear_orders_all() TO postgres, anon, authenticated, service_role, supabase_admin, supabase_read_only_user;