-- Fix security warnings: Add search_path to existing functions

DROP FUNCTION IF EXISTS public.calculate_bundle_availability(uuid);
CREATE OR REPLACE FUNCTION public.calculate_bundle_availability(bundle_uuid uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  min_qty INTEGER;
BEGIN
  SELECT MIN(
    FLOOR(
      COALESCE(ws.available_stock, 0)::NUMERIC / NULLIF(bc.quantity, 0)::NUMERIC
    )::INTEGER
  ) INTO min_qty
  FROM bundle_components bc
  LEFT JOIN products p ON p.id = bc.product_id
  LEFT JOIN warehouse_stock ws ON ws.product_id = bc.product_id
  WHERE bc.bundle_id = bundle_uuid
  GROUP BY bc.bundle_id;
  
  RETURN COALESCE(min_qty, 0);
END;
$function$;

DROP FUNCTION IF EXISTS public.calculate_bundle_cost(uuid);
CREATE OR REPLACE FUNCTION public.calculate_bundle_cost(bundle_uuid uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  total_cost NUMERIC;
BEGIN
  SELECT SUM(p.cost_price * bc.quantity) INTO total_cost
  FROM bundle_components bc
  JOIN products p ON p.id = bc.product_id
  WHERE bc.bundle_id = bundle_uuid;
  
  RETURN COALESCE(total_cost, 0);
END;
$function$;