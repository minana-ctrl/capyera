-- Fix update_product_velocities to accept product_id parameter and only update specific product
-- This prevents the "UPDATE requires a WHERE clause" error

-- 1. Fix the trigger function to pass NEW.product_id
CREATE OR REPLACE FUNCTION public.trigger_velocity_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only update velocity for the affected product
  IF NEW.product_id IS NOT NULL THEN
    PERFORM update_product_velocities_for_product(NEW.product_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Create new function that updates a single product
CREATE OR REPLACE FUNCTION public.update_product_velocities_for_product(p_product_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Update 7-day velocity for specific product
  UPDATE products
  SET velocity_7d = COALESCE(
    (SELECT SUM(oli.quantity)::numeric / 7
     FROM order_line_items oli
     JOIN orders o ON o.id = oli.order_id
     WHERE oli.product_id = p_product_id
       AND o.placed_at >= NOW() - INTERVAL '7 days'
       AND o.status NOT IN ('cancelled')),
    0
  )
  WHERE id = p_product_id;

  -- Update 14-day velocity for specific product
  UPDATE products
  SET velocity_14d = COALESCE(
    (SELECT SUM(oli.quantity)::numeric / 14
     FROM order_line_items oli
     JOIN orders o ON o.id = oli.order_id
     WHERE oli.product_id = p_product_id
       AND o.placed_at >= NOW() - INTERVAL '14 days'
       AND o.status NOT IN ('cancelled')),
    0
  )
  WHERE id = p_product_id;

  -- Update 30-day velocity for specific product
  UPDATE products
  SET velocity_30d = COALESCE(
    (SELECT SUM(oli.quantity)::numeric / 30
     FROM order_line_items oli
     JOIN orders o ON o.id = oli.order_id
     WHERE oli.product_id = p_product_id
       AND o.placed_at >= NOW() - INTERVAL '30 days'
       AND o.status NOT IN ('cancelled')),
    0
  )
  WHERE id = p_product_id;
END;
$function$;