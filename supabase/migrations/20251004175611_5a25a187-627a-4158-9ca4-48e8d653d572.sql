-- Function to automatically deduct inventory when order is fulfilled
CREATE OR REPLACE FUNCTION public.handle_order_fulfillment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When order status changes to 'fulfilled', deduct inventory
  IF NEW.fulfillment_status = 'fulfilled' AND (OLD.fulfillment_status IS NULL OR OLD.fulfillment_status != 'fulfilled') THEN
    -- Deduct inventory for each line item
    PERFORM deduct_inventory(oli.product_id, oli.quantity)
    FROM order_line_items oli
    WHERE oli.order_id = NEW.id
    AND oli.product_id IS NOT NULL;
    
    -- Update fulfilled_at timestamp
    NEW.fulfilled_at = NOW();
  END IF;
  
  -- When order is cancelled, release any reserved inventory
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    PERFORM release_inventory(oli.product_id, oli.quantity)
    FROM order_line_items oli
    WHERE oli.order_id = NEW.id
    AND oli.product_id IS NOT NULL;
    
    NEW.cancelled_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS order_fulfillment_inventory_update ON orders;

CREATE TRIGGER order_fulfillment_inventory_update
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION handle_order_fulfillment();