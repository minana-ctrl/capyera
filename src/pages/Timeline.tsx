import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { addDays, format } from "date-fns";
import { StockRunwayCalendar } from "@/components/timeline/StockRunwayCalendar";
import { TimelineProductCard } from "@/components/timeline/TimelineProductCard";
import { useInventoryData } from "@/hooks/useInventoryData";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Timeline = () => {
  const [velocityPeriod, setVelocityPeriod] = useState<"7d" | "14d" | "30d" | "90d">("30d");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(true);

  const { data: inventoryData, isLoading } = useInventoryData();

  // Calculate product runways and stockout dates
  const timelineData = useMemo(() => {
    if (!inventoryData) return { products: [], categories: [], stockoutEvents: [] };

    const velocityKey = velocityPeriod === "90d" ? "velocity_30d" : `velocity_${velocityPeriod}`;
    const multiplier = velocityPeriod === "90d" ? 3 : 1;

    const products = inventoryData.map((item) => {
      const velocity = (item[velocityKey as keyof typeof item] as number) || 0;
      const adjustedVelocity = velocityPeriod === "90d" ? velocity / multiplier : velocity;
      const runway = adjustedVelocity > 0 ? Math.floor(item.available_stock / adjustedVelocity) : 999;
      const stockoutDate = addDays(new Date(), runway);

      let status: "critical" | "warning" | "healthy";
      if (item.available_stock === 0 || runway <= 7) {
        status = "critical";
      } else if (item.current_level <= item.par_level * 0.5 || runway <= 14) {
        status = "warning";
      } else {
        status = "healthy";
      }

      return {
        ...item,
        velocity: adjustedVelocity,
        runway,
        stockoutDate,
        status,
      };
    });

    // Extract unique categories
    const categories = Array.from(new Set(products.map((p) => p.category_name).filter(Boolean)));

    // Group products by stockout date
    const stockoutMap = new Map<string, typeof products>();
    products.forEach((product) => {
      if (product.runway < 999 && product.velocity > 0) {
        const dateKey = format(product.stockoutDate, "yyyy-MM-dd");
        if (!stockoutMap.has(dateKey)) {
          stockoutMap.set(dateKey, []);
        }
        stockoutMap.get(dateKey)!.push(product);
      }
    });

    const stockoutEvents = Array.from(stockoutMap.entries()).map(([dateKey, products]) => ({
      date: new Date(dateKey),
      products: products.map((p) => ({
        sku: p.sku,
        name: p.name,
        available: p.available_stock,
        status: p.status,
      })),
    }));

    return { products, categories, stockoutEvents };
  }, [inventoryData, velocityPeriod]);

  // Apply filters
  const filteredProducts = useMemo(() => {
    let filtered = timelineData.products;

    if (selectedCategory !== "all") {
      filtered = filtered.filter((p) => p.category_name === selectedCategory);
    }

    if (selectedProducts.length > 0) {
      filtered = filtered.filter((p) => selectedProducts.includes(p.id));
    }

    // Filter out products with no sales velocity
    filtered = filtered.filter((p) => p.velocity > 0 && p.runway < 999);

    return filtered.sort((a, b) => a.runway - b.runway);
  }, [timelineData.products, selectedCategory, selectedProducts]);

  // Get products for selected date
  const selectedDateProducts = useMemo(() => {
    if (!selectedDate) return [];
    const event = timelineData.stockoutEvents.find((e) =>
      format(e.date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
    );
    return event?.products || [];
  }, [selectedDate, timelineData.stockoutEvents]);

  const handleToggleProduct = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleClearFilters = () => {
    setSelectedCategory("all");
    setSelectedProducts([]);
  };

  const hasActiveFilters = selectedCategory !== "all" || selectedProducts.length > 0;

  const availableProducts = useMemo(() => {
    if (selectedCategory === "all") return timelineData.products;
    return timelineData.products.filter((p) => p.category_name === selectedCategory);
  }, [timelineData.products, selectedCategory]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold">Stock Runway Timeline</h2>
          <p className="text-muted-foreground">Visualize when products will run out based on sales velocity</p>
        </div>

        {/* Forecast Controls */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Forecast Controls
              </CardTitle>
              <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {filtersOpen ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Hide Filters
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Show Filters
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            </div>
          </CardHeader>
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category Filter</label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {timelineData.categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Velocity Calculation</label>
                    <Select value={velocityPeriod} onValueChange={(v) => setVelocityPeriod(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="14d">Last 14 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                        <SelectItem value="90d">Last 90 Days (approx)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {availableProducts.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Product Selection ({selectedProducts.length} selected)
                    </label>
                    <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {availableProducts.slice(0, 50).map((product) => (
                          <div key={product.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={product.id}
                              checked={selectedProducts.includes(product.id)}
                              onCheckedChange={() => handleToggleProduct(product.id)}
                            />
                            <label
                              htmlFor={product.id}
                              className="text-sm cursor-pointer truncate flex-1"
                            >
                              {product.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {hasActiveFilters && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Active Filters:</span>
                    {selectedCategory !== "all" && (
                      <Badge variant="secondary">
                        Category: {selectedCategory}
                        <button
                          onClick={() => setSelectedCategory("all")}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {selectedProducts.length > 0 && (
                      <Badge variant="secondary">
                        {selectedProducts.length} Products Selected
                        <button
                          onClick={() => setSelectedProducts([])}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                      Clear All
                    </Button>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Tabbed Views */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-[600px] w-full" />
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="calendar" className="space-y-4">
            <TabsList>
              <TabsTrigger value="calendar">Calendar View</TabsTrigger>
              <TabsTrigger value="timeline">Timeline View</TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="space-y-4">
              <StockRunwayCalendar
                stockoutEvents={timelineData.stockoutEvents}
                onDateSelect={setSelectedDate}
                selectedDate={selectedDate}
              />

              {selectedDate && selectedDateProducts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Stock-Outs on {format(selectedDate, "MMMM dd, yyyy")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Available</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedDateProducts.map((product) => (
                          <TableRow key={product.sku}>
                            <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell className="text-right">{product.available}</TableCell>
                            <TableCell>
                              <Badge
                                variant={product.status === "critical" ? "destructive" : "secondary"}
                                className={product.status === "warning" ? "bg-orange-500 text-white" : ""}
                              >
                                {product.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              {filteredProducts.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredProducts.map((product) => (
                    <TimelineProductCard
                      key={product.id}
                      sku={product.sku}
                      name={product.name}
                      available={product.available_stock}
                      velocity={product.velocity}
                      runway={product.runway}
                      stockoutDate={product.stockoutDate}
                      status={product.status}
                      parLevel={product.par_level}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <p className="text-lg font-semibold">No products with sales velocity</p>
                    <p className="text-sm mt-2">
                      Products need sales history to calculate stock runway. Try selecting a different velocity period or category.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Timeline;
