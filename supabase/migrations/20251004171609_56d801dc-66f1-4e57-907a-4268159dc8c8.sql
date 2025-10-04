-- Create daily sales summary table for fast dashboard queries
CREATE TABLE IF NOT EXISTS public.daily_sales_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date DATE NOT NULL UNIQUE,
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  product_revenue NUMERIC NOT NULL DEFAULT 0,
  shipping_revenue NUMERIC NOT NULL DEFAULT 0,
  units_sold INTEGER NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.daily_sales_summary ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read summaries
CREATE POLICY "Authenticated users can view daily summaries"
  ON public.daily_sales_summary
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create index for fast date range queries
CREATE INDEX idx_daily_sales_summary_date ON public.daily_sales_summary(summary_date DESC);

-- Function to recalculate daily summary for a specific date
CREATE OR REPLACE FUNCTION public.recalculate_daily_summary(target_date DATE)
RETURNS VOID AS $$
DECLARE
  day_start TIMESTAMPTZ;
  day_end TIMESTAMPTZ;
BEGIN
  -- Calculate UTC boundaries for the date
  day_start := target_date::TIMESTAMPTZ;
  day_end := (target_date + INTERVAL '1 day')::TIMESTAMPTZ;
  
  -- Upsert the daily summary
  INSERT INTO public.daily_sales_summary (
    summary_date,
    total_revenue,
    product_revenue,
    shipping_revenue,
    order_count,
    units_sold,
    updated_at
  )
  SELECT
    target_date,
    COALESCE(SUM(o.total_amount), 0) as total_revenue,
    COALESCE(SUM(o.product_revenue), 0) as product_revenue,
    COALESCE(SUM(o.shipping_cost), 0) as shipping_revenue,
    COUNT(o.id) as order_count,
    COALESCE(SUM(oli.total_quantity), 0) as units_sold,
    NOW()
  FROM orders o
  LEFT JOIN (
    SELECT order_id, SUM(quantity) as total_quantity
    FROM order_line_items
    GROUP BY order_id
  ) oli ON oli.order_id = o.id
  WHERE o.placed_at >= day_start AND o.placed_at < day_end
  ON CONFLICT (summary_date) 
  DO UPDATE SET
    total_revenue = EXCLUDED.total_revenue,
    product_revenue = EXCLUDED.product_revenue,
    shipping_revenue = EXCLUDED.shipping_revenue,
    order_count = EXCLUDED.order_count,
    units_sold = EXCLUDED.units_sold,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function to update daily summary when orders change
CREATE OR REPLACE FUNCTION public.trigger_update_daily_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Update summary for the order's date
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_daily_summary(DATE(OLD.placed_at));
    RETURN OLD;
  ELSE
    PERFORM recalculate_daily_summary(DATE(NEW.placed_at));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to orders table
DROP TRIGGER IF EXISTS trigger_orders_update_summary ON public.orders;
CREATE TRIGGER trigger_orders_update_summary
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_daily_summary();

-- Trigger on order_line_items to update when quantities change
CREATE OR REPLACE FUNCTION public.trigger_line_items_update_summary()
RETURNS TRIGGER AS $$
DECLARE
  order_date DATE;
BEGIN
  -- Get the order date
  IF TG_OP = 'DELETE' THEN
    SELECT DATE(placed_at) INTO order_date FROM orders WHERE id = OLD.order_id;
  ELSE
    SELECT DATE(placed_at) INTO order_date FROM orders WHERE id = NEW.order_id;
  END IF;
  
  IF order_date IS NOT NULL THEN
    PERFORM recalculate_daily_summary(order_date);
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_line_items_update_summary ON public.order_line_items;
CREATE TRIGGER trigger_line_items_update_summary
  AFTER INSERT OR UPDATE OR DELETE ON public.order_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_line_items_update_summary();