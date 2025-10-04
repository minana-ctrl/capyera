-- Function to calculate and update product velocities based on actual orders
CREATE OR REPLACE FUNCTION public.update_product_velocities()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update 7-day velocity
  UPDATE products p
  SET velocity_7d = COALESCE(
    (SELECT SUM(oli.quantity)::numeric / 7
     FROM order_line_items oli
     JOIN orders o ON o.id = oli.order_id
     WHERE oli.product_id = p.id
       AND o.placed_at >= NOW() - INTERVAL '7 days'
       AND o.status NOT IN ('cancelled')),
    0
  );

  -- Update 14-day velocity
  UPDATE products p
  SET velocity_14d = COALESCE(
    (SELECT SUM(oli.quantity)::numeric / 14
     FROM order_line_items oli
     JOIN orders o ON o.id = oli.order_id
     WHERE oli.product_id = p.id
       AND o.placed_at >= NOW() - INTERVAL '14 days'
       AND o.status NOT IN ('cancelled')),
    0
  );

  -- Update 30-day velocity
  UPDATE products p
  SET velocity_30d = COALESCE(
    (SELECT SUM(oli.quantity)::numeric / 30
     FROM order_line_items oli
     JOIN orders o ON o.id = oli.order_id
     WHERE oli.product_id = p.id
       AND o.placed_at >= NOW() - INTERVAL '30 days'
       AND o.status NOT IN ('cancelled')),
    0
  );
END;
$$;

-- Create a trigger to automatically update velocities when new orders come in
CREATE OR REPLACE FUNCTION public.trigger_velocity_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update velocities for the affected product
  PERFORM update_product_velocities();
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_velocities_on_order ON order_line_items;

-- Create trigger on order_line_items
CREATE TRIGGER update_velocities_on_order
AFTER INSERT OR UPDATE ON order_line_items
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_velocity_update();

-- Run initial velocity calculation
SELECT update_product_velocities();