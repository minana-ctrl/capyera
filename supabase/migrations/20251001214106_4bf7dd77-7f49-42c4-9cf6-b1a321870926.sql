-- Add reserved_stock and available_stock tracking
ALTER TABLE public.warehouse_stock
ADD COLUMN IF NOT EXISTS reserved_stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS available_stock INTEGER GENERATED ALWAYS AS (quantity - reserved_stock) STORED;

-- Create orders table for Shopify integration
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  shopify_order_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  fulfillment_status TEXT DEFAULT 'unfulfilled',
  customer_email TEXT,
  customer_name TEXT,
  total_amount NUMERIC DEFAULT 0,
  product_revenue NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  country_code TEXT,
  shipping_address JSONB,
  placed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  is_new_customer BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create order line items table
CREATE TABLE IF NOT EXISTS public.order_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  bundle_id UUID REFERENCES public.bundles(id),
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view orders"
  ON public.orders FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update orders"
  ON public.orders FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view order items"
  ON public.order_line_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert order items"
  ON public.order_line_items FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate bundle availability
CREATE OR REPLACE FUNCTION public.calculate_bundle_availability(bundle_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
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
$$;

-- Function to calculate bundle cost
CREATE OR REPLACE FUNCTION public.calculate_bundle_cost(bundle_uuid UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_cost NUMERIC;
BEGIN
  SELECT SUM(p.cost_price * bc.quantity) INTO total_cost
  FROM bundle_components bc
  JOIN products p ON p.id = bc.product_id
  WHERE bc.bundle_id = bundle_uuid;
  
  RETURN COALESCE(total_cost, 0);
END;
$$;