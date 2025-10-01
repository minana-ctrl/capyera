-- Create warehouse stock levels table
CREATE TABLE IF NOT EXISTS public.warehouse_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  par_level INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 0,
  last_counted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id, warehouse_id)
);

-- Enable RLS
ALTER TABLE public.warehouse_stock ENABLE ROW LEVEL SECURITY;

-- RLS Policies for warehouse_stock
CREATE POLICY "Authenticated users can view warehouse stock"
  ON public.warehouse_stock FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert warehouse stock"
  ON public.warehouse_stock FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update warehouse stock"
  ON public.warehouse_stock FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Add product image URL field
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create import history log table
CREATE TABLE IF NOT EXISTS public.import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type TEXT NOT NULL,
  file_name TEXT,
  records_imported INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_log JSONB,
  imported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for import_logs
CREATE POLICY "Authenticated users can view import logs"
  ON public.import_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert import logs"
  ON public.import_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Add velocity tracking fields to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS velocity_7d NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS velocity_14d NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS velocity_30d NUMERIC DEFAULT 0;

-- Create product images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product images
CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can update product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
  );

-- Trigger for updated_at on warehouse_stock
CREATE TRIGGER update_warehouse_stock_updated_at
  BEFORE UPDATE ON public.warehouse_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();