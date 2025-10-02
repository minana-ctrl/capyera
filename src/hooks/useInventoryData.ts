import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InventoryItem {
  id: string;
  product_id: string;
  warehouse_id: string;
  sku: string;
  name: string;
  description?: string;
  category_id?: string;
  category_name?: string;
  image_url?: string;
  type: "individual" | "bundle";
  par_level: number;
  current_level: number;
  reserved_stock: number;
  available_stock: number;
  velocity_7d: number;
  velocity_14d: number;
  velocity_30d: number;
  warehouse_name: string;
}

export const useInventoryData = () => {
  return useQuery({
    queryKey: ["inventory-data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_stock")
        .select(`
          *,
          products (
            id,
            sku,
            name,
            description,
            image_url,
            velocity_7d,
            velocity_14d,
            velocity_30d,
            category_id,
            categories (
              name
            )
          ),
          warehouses (
            name
          )
        `)
        .order("available_stock", { ascending: true });

      if (error) throw error;

      // Transform to InventoryItem format
      const items: InventoryItem[] = (data || []).map((item) => ({
        id: item.id,
        product_id: item.product_id,
        warehouse_id: item.warehouse_id,
        sku: item.products?.sku || "",
        name: item.products?.name || "",
        description: item.products?.description,
        category_id: item.products?.category_id,
        category_name: item.products?.categories?.name,
        image_url: item.products?.image_url,
        type: "individual", // TODO: Add bundle detection
        par_level: item.par_level || 0,
        current_level: item.quantity || 0,
        reserved_stock: item.reserved_stock || 0,
        available_stock: item.available_stock || 0,
        velocity_7d: item.products?.velocity_7d || 0,
        velocity_14d: item.products?.velocity_14d || 0,
        velocity_30d: item.products?.velocity_30d || 0,
        warehouse_name: item.warehouses?.name || "",
      }));

      return items;
    },
  });
};
