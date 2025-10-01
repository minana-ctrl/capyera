import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Upload, AlertTriangle, TrendingUp } from "lucide-react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Inventory = () => {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["warehouse-stock", selectedWarehouse],
    queryFn: async () => {
      let query = supabase
        .from("warehouse_stock")
        .select(`
          *,
          products (
            sku,
            name,
            image_url,
            unit_price,
            categories (
              name
            )
          ),
          warehouses (
            name
          )
        `)
        .order("quantity", { ascending: true });

      if (selectedWarehouse !== "all") {
        query = query.eq("warehouse_id", selectedWarehouse);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getLowStockStatus = (quantity: number, parLevel: number) => {
    if (quantity === 0) return { status: "Out of Stock", color: "bg-red-500" };
    if (quantity <= parLevel * 0.5) return { status: "Critical", color: "bg-orange-500" };
    if (quantity <= parLevel) return { status: "Low Stock", color: "bg-yellow-500" };
    return { status: "In Stock", color: "bg-green-500" };
  };

  const lowStockCount = inventory?.filter(item => item.quantity <= item.par_level).length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Inventory Management</h2>
            <p className="text-muted-foreground">Track stock levels across warehouses</p>
          </div>
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Import Products
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inventory?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{lowStockCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warehouses</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{warehouses?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${inventory?.reduce((sum, item) => sum + (item.quantity * Number(item.products?.unit_price || 0)), 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Stock Levels
              </CardTitle>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses?.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                      <TableHead className="text-right">Par Level</TableHead>
                      <TableHead className="text-right">Reorder Point</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory?.map((item) => {
                      const stockStatus = getLowStockStatus(item.quantity, item.par_level);
                      return (
                        <TableRow key={item.id} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-sm">{item.products?.sku}</TableCell>
                          <TableCell className="font-medium">{item.products?.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.products?.categories?.name || "N/A"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.warehouses?.name}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{item.par_level}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{item.reorder_point}</TableCell>
                          <TableCell>
                            <Badge className={stockStatus.color}>{stockStatus.status}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {!isLoading && inventory?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                No inventory data found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Inventory;
