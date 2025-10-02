-- Step 1: Clean up duplicate warehouses
-- Keep the oldest warehouse for each name and update references
DO $$
DECLARE
  warehouse_name TEXT;
  keeper_id UUID;
  duplicate_id UUID;
BEGIN
  -- For each duplicate warehouse name
  FOR warehouse_name IN 
    SELECT name FROM warehouses GROUP BY name HAVING COUNT(*) > 1
  LOOP
    -- Get the ID of the oldest warehouse to keep
    SELECT id INTO keeper_id 
    FROM warehouses 
    WHERE name = warehouse_name 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- Update all references to point to the keeper
    FOR duplicate_id IN 
      SELECT id FROM warehouses 
      WHERE name = warehouse_name AND id != keeper_id
    LOOP
      -- Update warehouse_stock references
      UPDATE warehouse_stock 
      SET warehouse_id = keeper_id 
      WHERE warehouse_id = duplicate_id;
      
      -- Update purchase_orders references
      UPDATE purchase_orders 
      SET warehouse_id = keeper_id 
      WHERE warehouse_id = duplicate_id;
      
      -- Update sales_orders references
      UPDATE sales_orders 
      SET warehouse_id = keeper_id 
      WHERE warehouse_id = duplicate_id;
      
      -- Update stock_movements references
      UPDATE stock_movements 
      SET warehouse_id = keeper_id 
      WHERE warehouse_id = duplicate_id;
      
      -- Delete the duplicate
      DELETE FROM warehouses WHERE id = duplicate_id;
    END LOOP;
  END LOOP;
END $$;

-- Step 2: Clean up duplicate categories
-- Keep the oldest category for each name and update references
DO $$
DECLARE
  category_name TEXT;
  keeper_id UUID;
  duplicate_id UUID;
BEGIN
  -- For each duplicate category name
  FOR category_name IN 
    SELECT name FROM categories GROUP BY name HAVING COUNT(*) > 1
  LOOP
    -- Get the ID of the oldest category to keep
    SELECT id INTO keeper_id 
    FROM categories 
    WHERE name = category_name 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- Update all references to point to the keeper
    FOR duplicate_id IN 
      SELECT id FROM categories 
      WHERE name = category_name AND id != keeper_id
    LOOP
      -- Update products references
      UPDATE products 
      SET category_id = keeper_id 
      WHERE category_id = duplicate_id;
      
      -- Update bundles references
      UPDATE bundles 
      SET category_id = keeper_id 
      WHERE category_id = duplicate_id;
      
      -- Update parent_id references (subcategories)
      UPDATE categories 
      SET parent_id = keeper_id 
      WHERE parent_id = duplicate_id;
      
      -- Delete the duplicate
      DELETE FROM categories WHERE id = duplicate_id;
    END LOOP;
  END LOOP;
END $$;

-- Step 3: Add unique constraints to prevent future duplicates
ALTER TABLE warehouses ADD CONSTRAINT warehouses_name_unique UNIQUE (name);
ALTER TABLE categories ADD CONSTRAINT categories_name_unique UNIQUE (name);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_warehouses_name ON warehouses(name);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);