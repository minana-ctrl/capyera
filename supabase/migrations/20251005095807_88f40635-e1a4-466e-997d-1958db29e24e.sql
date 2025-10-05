
-- Fix inventory management functions to NOT update generated available_stock column

-- 1. Fix reserve_inventory function
CREATE OR REPLACE FUNCTION public.reserve_inventory(p_product_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only increment reserved_stock; available_stock will auto-calculate
  UPDATE warehouse_stock
  SET 
    reserved_stock = COALESCE(reserved_stock, 0) + p_quantity,
    updated_at = NOW()
  WHERE product_id = p_product_id;
END;
$function$;

-- 2. Fix deduct_inventory function
CREATE OR REPLACE FUNCTION public.deduct_inventory(p_product_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Reduce both quantity and reserved_stock; available_stock will auto-calculate
  UPDATE warehouse_stock
  SET 
    quantity = quantity - p_quantity,
    reserved_stock = GREATEST(COALESCE(reserved_stock, 0) - p_quantity, 0),
    updated_at = NOW()
  WHERE product_id = p_product_id;
END;
$function$;

-- 3. Fix release_inventory function
CREATE OR REPLACE FUNCTION public.release_inventory(p_product_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only decrement reserved_stock; available_stock will auto-calculate
  UPDATE warehouse_stock
  SET 
    reserved_stock = GREATEST(COALESCE(reserved_stock, 0) - p_quantity, 0),
    updated_at = NOW()
  WHERE product_id = p_product_id;
END;
$function$;
