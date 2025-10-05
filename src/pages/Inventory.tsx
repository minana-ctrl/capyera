import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Upload, AlertTriangle, TrendingUp, Search, FileDown, History, Package2, TrendingDown, Minus, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
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
import { useInventoryData } from "@/hooks/useInventoryData";
import { StatsCard } from "@/components/inventory/StatsCard";
import { CategoryBadge } from "@/components/inventory/CategoryBadge";
import { HealthBadge } from "@/components/inventory/HealthBadge";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const Inventory = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [velocityPeriod, setVelocityPeriod] = useState<"7d" | "14d" | "30d">("7d");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [inboundLogOpen, setInboundLogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const categoryFilter = searchParams.get("category") || null;
  const healthFilter = searchParams.get("health") || null;

  const { data: inventory, isLoading, refetch } = useInventoryData();
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

  // Calculate overall statistics
  const stats = useMemo(() => {
    if (!inventory) return null;

    const totalProducts = inventory.length;
    const totalStock = inventory.reduce((sum, item) => sum + item.current_level, 0);
    
    const healthyItems = inventory.filter(item => {
      const daysRemaining = item.velocity_7d > 0 ? item.current_level / item.velocity_7d : 999;
      return item.current_level > item.par_level && daysRemaining > 14;
    }).length;
    
    const criticalItems = inventory.filter(item => {
      const daysRemaining = item.velocity_7d > 0 ? item.current_level / item.velocity_7d : 999;
      return item.current_level === 0 || daysRemaining <= 7;
    }).length;

    const healthPercentage = totalProducts > 0 ? Math.round((healthyItems / totalProducts) * 100) : 0;

    return {
      totalProducts,
      totalStock,
      healthPercentage,
      healthyItems,
      criticalItems,
    };
  }, [inventory]);

  // Calculate category statistics
  const categoryStats = useMemo(() => {
    if (!inventory || !categories) return [];

    return categories.map(category => {
      const categoryItems = inventory.filter(item => item.category_id === category.id);
      const activeProducts = categoryItems.length;
      const totalStock = categoryItems.reduce((sum, item) => sum + item.available_stock, 0);
      
      const healthyCount = categoryItems.filter(item => {
        const daysRemaining = item.velocity_7d > 0 ? item.current_level / item.velocity_7d : 999;
        return item.current_level > item.par_level && daysRemaining > 14;
      }).length;
      
      const criticalCount = categoryItems.filter(item => {
        const daysRemaining = item.velocity_7d > 0 ? item.current_level / item.velocity_7d : 999;
        return item.current_level === 0 || daysRemaining <= 7;
      }).length;

      const healthPercentage = activeProducts > 0 ? Math.round((healthyCount / activeProducts) * 100) : 0;

      // Calculate velocity trend (simplified)
      const avgVelocity = categoryItems.reduce((sum, item) => sum + item.velocity_7d, 0) / (activeProducts || 1);
      const velocityTrend = avgVelocity > 5 ? "up" : avgVelocity > 2 ? "stable" : "down";

      return {
        id: category.id,
        name: category.name,
        activeProducts,
        totalStock,
        healthPercentage,
        criticalCount,
        velocityTrend,
      };
    });
  }, [inventory, categories]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Filter and sort inventory
  const filteredInventory = useMemo(() => {
    if (!inventory) return [];

    let filtered = inventory.filter(item => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(query) && !item.sku.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter) {
        if (item.category_id !== categoryFilter) return false;
      }

      // Health filter
      if (healthFilter) {
        const daysRemaining = item.velocity_7d > 0 ? item.current_level / item.velocity_7d : 999;
        
        if (healthFilter === "critical" && !(item.current_level === 0 || daysRemaining <= 7)) {
          return false;
        }
        if (healthFilter === "warning" && !(item.current_level <= item.par_level * 0.5 || (daysRemaining > 7 && daysRemaining <= 14))) {
          return false;
        }
        if (healthFilter === "healthy" && !(item.current_level > item.par_level && daysRemaining > 14)) {
          return false;
        }
      }

      return true;
    });

    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any = a[sortField as keyof typeof a];
        let bVal: any = b[sortField as keyof typeof b];

        // Handle velocity fields
        if (sortField === 'velocity') {
          aVal = a[`velocity_${velocityPeriod}` as keyof typeof a];
          bVal = b[`velocity_${velocityPeriod}` as keyof typeof b];
        }

        // Handle numeric values
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        }

        // Handle string values
        const aStr = String(aVal || '').toLowerCase();
        const bStr = String(bVal || '').toLowerCase();
        if (sortDirection === "asc") {
          return aStr.localeCompare(bStr);
        }
        return bStr.localeCompare(aStr);
      });
    }

    return filtered;
  }, [inventory, searchQuery, categoryFilter, healthFilter, sortField, sortDirection, velocityPeriod]);

  const clearFilters = () => {
    setSearchParams({});
    setSearchQuery("");
  };

  const hasActiveFilters = categoryFilter || healthFilter || searchQuery;

  const exportToCSV = () => {
    if (!filteredInventory || filteredInventory.length === 0) return;

    const headers = ["SKU", "Product Name", "Category", "Type", "Par Level", "Current Level", "Reserved", "Available", "Velocity", "Warehouse"];
    const rows = filteredInventory.map(item => [
      item.sku,
      item.name,
      item.category_name || "Uncategorized",
      item.type,
      item.par_level,
      item.current_level,
      item.reserved_stock,
      item.available_stock,
      item[`velocity_${velocityPeriod}`],
      item.warehouse_name,
    ]);

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Inventory Management</h2>
            <p className="text-muted-foreground">Monitor stock levels and manage inventory</p>
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

        {/* Overall Statistics */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid gap-4 md:grid-cols-4">
            <StatsCard
              title="Total Products"
              value={stats.totalProducts}
              icon={Package}
              description="Active SKUs"
            />
            <StatsCard
              title="Total Stock"
              value={stats.totalStock.toLocaleString()}
              icon={TrendingUp}
              description="Units across all warehouses"
              trend={{ value: "12% vs last month", positive: true }}
            />
            <StatsCard
              title="Inventory Health"
              value={`${stats.healthPercentage}%`}
              icon={TrendingUp}
              description={`${stats.healthyItems} of ${stats.totalProducts} healthy`}
            />
            <StatsCard
              title="Critical Items"
              value={stats.criticalItems}
              icon={AlertTriangle}
              variant="critical"
              description="Requiring immediate attention"
            />
          </div>
        ) : null}

        {/* Category Statistics Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : categoryStats.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categoryStats.map(cat => (
              <Card
                key={cat.id}
                className="cursor-pointer transition-all hover:shadow-md"
                onClick={() => setSearchParams({ category: cat.id })}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{cat.name}</CardTitle>
                    {cat.velocityTrend === "up" && <TrendingUp className="h-4 w-4 text-green-500" />}
                    {cat.velocityTrend === "down" && <TrendingDown className="h-4 w-4 text-red-500" />}
                    {cat.velocityTrend === "stable" && <Minus className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {cat.activeProducts} products
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Health</span>
                      <span className="text-xs font-medium">{cat.healthPercentage}%</span>
                    </div>
                    <Progress value={cat.healthPercentage} className="h-2" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Available:</span>
                    <span className="font-semibold">{cat.totalStock}</span>
                  </div>
                  {cat.criticalCount > 0 && (
                    <Badge variant="destructive" className="w-full justify-center">
                      {cat.criticalCount} critical item{cat.criticalCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {/* Main Inventory Table */}
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Inventory Table
                </CardTitle>
                <Select value={velocityPeriod} onValueChange={(v: any) => setVelocityPeriod(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">7-Day Velocity</SelectItem>
                    <SelectItem value="14d">14-Day Velocity</SelectItem>
                    <SelectItem value="30d">30-Day Velocity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filters */}
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

                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>

              {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Active filters:</span>
                  {categoryFilter && (
                    <Badge variant="secondary">
                      Category: {categories?.find(c => c.id === categoryFilter)?.name}
                    </Badge>
                  )}
                  {healthFilter && (
                    <Badge variant="secondary">
                      Health: {healthFilter}
                    </Badge>
                  )}
                  {searchQuery && (
                    <Badge variant="secondary">
                      Search: "{searchQuery}"
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => handleSort('sku')} className="h-8 px-2">
                          SKU
                          <SortIcon field="sku" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => handleSort('name')} className="h-8 px-2">
                          Product
                          <SortIcon field="name" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => handleSort('category_name')} className="h-8 px-2">
                          Category
                          <SortIcon field="category_name" />
                        </Button>
                      </TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleSort('par_level')} className="h-8 px-2">
                          Par Level
                          <SortIcon field="par_level" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleSort('current_level')} className="h-8 px-2">
                          Current
                          <SortIcon field="current_level" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleSort('reserved_stock')} className="h-8 px-2">
                          Reserved
                          <SortIcon field="reserved_stock" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleSort('available_stock')} className="h-8 px-2">
                          Available
                          <SortIcon field="available_stock" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleSort('velocity')} className="h-8 px-2">
                          Velocity
                          <SortIcon field="velocity" />
                        </Button>
                      </TableHead>
                      <TableHead>Health</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.map((item) => (
                      <TableRow
                        key={item.id}
                        className="hover:bg-muted/50"
                      >
                        <TableCell>
                          {item.type === "bundle" ? (
                            <Package2 className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                        <TableCell>
                          <div className="cursor-pointer" onClick={() => setSelectedProduct(item.product_id)}>
                            <div className="font-medium">{item.name}</div>
                            {item.description && (
                              <div className="text-xs text-muted-foreground">{item.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <CategoryBadge category={item.category_name} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.type}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{item.par_level}</TableCell>
                        <TableCell className="text-right">
                          <span className={item.current_level < item.par_level ? "text-destructive font-semibold" : "font-medium"}>
                            {item.current_level}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.reserved_stock}</TableCell>
                        <TableCell className="text-right font-semibold">{item.available_stock}</TableCell>
                        <TableCell className="text-right font-medium">
                          {item[`velocity_${velocityPeriod}`].toFixed(1)}/day
                        </TableCell>
                        <TableCell>
                          <HealthBadge
                            currentLevel={item.current_level}
                            parLevel={item.par_level}
                            velocity={item[`velocity_${velocityPeriod}`]}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {!isLoading && filteredInventory.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                {hasActiveFilters ? "No items match your filters" : "No inventory data found"}
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
          product={inventory?.find(i => i.product_id === selectedProduct)}
          onInventoryUpdate={() => refetch()}
        />
      )}
    </DashboardLayout>
  );
};

export default Inventory;
