import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Package, Upload, AlertTriangle, TrendingUp, Search, Download, History, FileDown } from "lucide-react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImportInventoryDialog } from "@/components/ImportInventoryDialog";
import { InboundLogDialog } from "@/components/InboundLogDialog";
import { ProductFormDialog } from "@/components/ProductFormDialog";

const Inventory = () => {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stockHealthFilter, setStockHealthFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [inboundLogOpen, setInboundLogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

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

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: inventory, isLoading, refetch } = useQuery({
    queryKey: ["warehouse-stock", selectedWarehouse],
    queryFn: async () => {
      let query = supabase
        .from("warehouse_stock")
        .select(`
          *,
          products (
            id,
            sku,
            name,
            image_url,
            unit_price,
            velocity_7d,
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

      if (selectedWarehouse !== "all") {
        query = query.eq("warehouse_id", selectedWarehouse);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getStockHealth = (available: number, parLevel: number) => {
    if (available === 0) {
      return { status: "Out of Stock", color: "bg-destructive text-destructive-foreground", health: "critical" };
    }
    if (available <= parLevel * 0.2) {
      return { status: "Critical", color: "bg-destructive text-destructive-foreground", health: "critical" };
    }
    if (available <= parLevel * 0.5) {
      return { status: "Warning", color: "bg-orange-500 text-white", health: "warning" };
    }
    if (available <= parLevel) {
      return { status: "Low Stock", color: "bg-yellow-500 text-black", health: "low" };
    }
    return { status: "Healthy", color: "bg-green-500 text-white", health: "healthy" };
  };

  const filteredInventory = inventory?.filter(item => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        item.products?.name?.toLowerCase().includes(query) ||
        item.products?.sku?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Category filter
    if (selectedCategory !== "all") {
      if (selectedCategory === "uncategorized") {
        if (item.products?.category_id) return false;
      } else {
        if (item.products?.category_id !== selectedCategory) return false;
      }
    }

    // Stock health filter
    if (stockHealthFilter !== "all") {
      const health = getStockHealth(item.available_stock || 0, item.par_level || 0);
      if (health.health !== stockHealthFilter) return false;
    }

    return true;
  });

  const lowStockCount = inventory?.filter(item => {
    const health = getStockHealth(item.available_stock || 0, item.par_level || 0);
    return health.health === "low" || health.health === "warning" || health.health === "critical";
  }).length || 0;

  const exportToCSV = () => {
    if (!filteredInventory || filteredInventory.length === 0) return;

    const headers = ["SKU", "Product Name", "Warehouse", "Current Stock", "Par Level", "Reorder Point", "Stock Health", "7-Day Velocity"];
    const rows = filteredInventory.map(item => {
      const health = getStockHealth(item.available_stock || 0, item.par_level || 0);
      return [
        item.products?.sku || "",
        item.products?.name || "",
        item.warehouses?.name || "",
        item.available_stock || 0,
        item.par_level || 0,
        item.reorder_point || 0,
        health.status,
        item.products?.velocity_7d || 0,
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Inventory Management</h2>
            <p className="text-muted-foreground">Track stock levels and manage inventory</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setInboundLogOpen(true)}>
              <History className="h-4 w-4" />
              Inbound Log
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportToCSV}>
              <FileDown className="h-4 w-4" />
              Export
            </Button>
            <Button className="gap-2" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4" />
              Import Inventory
            </Button>
          </div>
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
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Stock Levels
              </CardTitle>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by product name or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Warehouse" />
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

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={stockHealthFilter} onValueChange={setStockHealthFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Stock Health" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="healthy">Healthy</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
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
                      <TableHead className="w-[80px]">Image</TableHead>
                      <TableHead className="sticky left-0 bg-background z-10">Product Name</TableHead>
                      <TableHead className="sticky left-[200px] bg-background z-10">SKU</TableHead>
                      <TableHead className="text-right">Current Level</TableHead>
                      <TableHead className="text-right">Par Level</TableHead>
                      <TableHead>Stock Health</TableHead>
                      <TableHead className="text-right">7-Day Velocity</TableHead>
                      <TableHead>Warehouse</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory?.map((item) => {
                      const health = getStockHealth(item.available_stock || 0, item.par_level || 0);
                        
                      return (
                        <TableRow 
                          key={item.id} 
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => item.products?.id && setSelectedProduct(item.products.id)}
                        >
                          <TableCell>
                            {item.products?.image_url ? (
                              <img 
                                src={item.products.image_url} 
                                alt={item.products.name} 
                                className="h-10 w-10 object-cover rounded"
                              />
                            ) : (
                              <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium sticky left-0 bg-background">
                            {item.products?.name}
                          </TableCell>
                          <TableCell className="font-mono text-sm sticky left-[200px] bg-background">
                            {item.products?.sku}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-semibold">{item.available_stock || 0}</div>
                            <div className="text-xs text-muted-foreground">
                              ({item.quantity || 0} total)
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.par_level || 0}
                          </TableCell>
                          <TableCell>
                            <Badge className={health.color}>{health.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <TrendingUp className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">{item.products?.velocity_7d || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.warehouses?.name}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {!isLoading && (!filteredInventory || filteredInventory.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                {inventory?.length === 0 ? "No inventory data found" : "No items match your filters"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ImportInventoryDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={() => refetch()}
      />

      <InboundLogDialog
        open={inboundLogOpen}
        onOpenChange={setInboundLogOpen}
      />

      {selectedProduct && (
        <ProductFormDialog
          open={!!selectedProduct}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedProduct(null);
              refetch();
            }
          }}
          product={inventory?.find(i => i.products?.id === selectedProduct)?.products}
        />
      )}
    </DashboardLayout>
  );
};

export default Inventory;
