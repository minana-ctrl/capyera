-- Create inventory management functions for Shopify integration

-- Function to reserve inventory when an order is created
CREATE OR REPLACE FUNCTION public.reserve_inventory(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Increment reserved_stock
  UPDATE warehouse_stock
  SET 
    reserved_stock = COALESCE(reserved_stock, 0) + p_quantity,
    available_stock = quantity - (COALESCE(reserved_stock, 0) + p_quantity),
    updated_at = NOW()
  WHERE product_id = p_product_id;
END;
$$;

-- Function to deduct inventory when an order is fulfilled
CREATE OR REPLACE FUNCTION public.deduct_inventory(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reduce both quantity and reserved_stock
  UPDATE warehouse_stock
  SET 
    quantity = quantity - p_quantity,
    reserved_stock = GREATEST(COALESCE(reserved_stock, 0) - p_quantity, 0),
    available_stock = (quantity - p_quantity) - GREATEST(COALESCE(reserved_stock, 0) - p_quantity, 0),
    updated_at = NOW()
  WHERE product_id = p_product_id;
END;
$$;

-- Function to release inventory when an order is cancelled
CREATE OR REPLACE FUNCTION public.release_inventory(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Decrement reserved_stock
  UPDATE warehouse_stock
  SET 
    reserved_stock = GREATEST(COALESCE(reserved_stock, 0) - p_quantity, 0),
    available_stock = quantity - GREATEST(COALESCE(reserved_stock, 0) - p_quantity, 0),
    updated_at = NOW()
  WHERE product_id = p_product_id;
END;
$$;