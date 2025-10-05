-- Fix reserve_inventory to handle missing warehouse_stock entries
CREATE OR REPLACE FUNCTION public.reserve_inventory(p_product_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_warehouse_id uuid;
  v_row_count integer;
BEGIN
  -- Try to update existing warehouse_stock
  UPDATE warehouse_stock
  SET 
    reserved_stock = COALESCE(reserved_stock, 0) + p_quantity,
    updated_at = NOW()
  WHERE product_id = p_product_id;
  
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  
  -- If no rows were updated, create a new warehouse_stock entry
  IF v_row_count = 0 THEN
    -- Get the first warehouse (or you can make this configurable)
    SELECT id INTO v_warehouse_id FROM warehouses LIMIT 1;
    
    IF v_warehouse_id IS NULL THEN
      RAISE EXCEPTION 'No warehouse found to reserve inventory';
    END IF;
    
    -- Insert new warehouse_stock entry
    INSERT INTO warehouse_stock (
      product_id,
      warehouse_id,
      quantity,
      reserved_stock,
      par_level,
      reorder_point
    ) VALUES (
      p_product_id,
      v_warehouse_id,
      0,
      p_quantity,
      0,
      0
    );
  END IF;
END;
$function$;

-- Fix deduct_inventory to handle missing warehouse_stock entries
CREATE OR REPLACE FUNCTION public.deduct_inventory(p_product_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row_count integer;
BEGIN
  -- Try to update existing warehouse_stock
  UPDATE warehouse_stock
  SET 
    quantity = GREATEST(quantity - p_quantity, 0),
    reserved_stock = GREATEST(COALESCE(reserved_stock, 0) - p_quantity, 0),
    updated_at = NOW()
  WHERE product_id = p_product_id;
  
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  
  -- Log warning if no rows were updated
  IF v_row_count = 0 THEN
    RAISE WARNING 'No warehouse_stock entry found for product_id: %', p_product_id;
  END IF;
END;
$function$;

-- Fix release_inventory to handle missing warehouse_stock entries
CREATE OR REPLACE FUNCTION public.release_inventory(p_product_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row_count integer;
BEGIN
  -- Try to update existing warehouse_stock
  UPDATE warehouse_stock
  SET 
    reserved_stock = GREATEST(COALESCE(reserved_stock, 0) - p_quantity, 0),
    updated_at = NOW()
  WHERE product_id = p_product_id;
  
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  
  -- Log warning if no rows were updated
  IF v_row_count = 0 THEN
    RAISE WARNING 'No warehouse_stock entry found for product_id: %', p_product_id;
  END IF;
END;
$function$;