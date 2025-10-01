import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, TrendingUp, Package, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

const Timeline = () => {
  const [dateRange, setDateRange] = useState<{ from: Date; to?: Date }>({
    from: new Date(),
    to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  const [velocityPeriod, setVelocityPeriod] = useState<"7d" | "14d" | "30d">("30d");

  const { data: forecastData, isLoading } = useQuery({
    queryKey: ["timeline-forecast", velocityPeriod],
    queryFn: async () => {
      const { data: stock } = await supabase
        .from("warehouse_stock")
        .select(`
          *,
          products (
            id,
            sku,
            name
          )
        `);

      if (!stock) return { products: [], stats: { avgRunway: 0, reorderNeeded: 0, stockoutRisk: 0 } };

      // Calculate velocity from order history using SKU matching
      const daysBack = velocityPeriod === "7d" ? 7 : velocityPeriod === "14d" ? 14 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data: lineItems } = await supabase
        .from("order_line_items")
        .select("sku, quantity")
        .gte("created_at", startDate.toISOString());

      // Aggregate quantities by SKU
      const productSales = lineItems?.reduce((acc: any, item) => {
        if (!acc[item.sku]) acc[item.sku] = 0;
        acc[item.sku] += item.quantity;
        return acc;
      }, {}) || {};

      // Calculate runway for each product using SKU matching
      const products = stock.map((item: any) => {
        const sku = item.products?.sku || '';
        const totalSold = productSales[sku] || 0;
        const dailyVelocity = totalSold / daysBack;
        const availableStock = item.available_stock || 0;
        const runway = dailyVelocity > 0 ? Math.floor(availableStock / dailyVelocity) : 999;
        const stockoutDate = addDays(new Date(), runway);

        return {
          sku,
          name: item.products?.name || 'Unknown Product',
          available: availableStock,
          velocity: dailyVelocity.toFixed(2),
          runway,
          stockoutDate,
          status: runway < 7 ? 'critical' : runway < 14 ? 'warning' : 'good',
          belowReorder: availableStock <= (item.reorder_point || 0),
          parLevel: item.par_level || 0,
        };
      });

      // Calculate stats
      const productsWithSales = products.filter((p: any) => parseFloat(p.velocity) > 0);
      const validProducts = productsWithSales.filter((p: any) => p.runway < 999);
      const avgRunway = validProducts.length > 0
        ? Math.floor(validProducts.reduce((sum: number, p: any) => sum + p.runway, 0) / validProducts.length)
        : 0;
      const reorderNeeded = products.filter((p: any) => p.belowReorder).length;
      const stockoutRisk = productsWithSales.filter((p: any) => p.runway < 7).length;

      // Prepare chart data - group by runway buckets
      const runwayBuckets = [
        { name: '0-7 days', count: 0, color: '#ef4444' },
        { name: '8-14 days', count: 0, color: '#f97316' },
        { name: '15-30 days', count: 0, color: '#eab308' },
        { name: '31-60 days', count: 0, color: '#22c55e' },
        { name: '60+ days', count: 0, color: '#3b82f6' },
      ];

      productsWithSales.forEach((p: any) => {
        if (p.runway <= 7) runwayBuckets[0].count++;
        else if (p.runway <= 14) runwayBuckets[1].count++;
        else if (p.runway <= 30) runwayBuckets[2].count++;
        else if (p.runway <= 60) runwayBuckets[3].count++;
        else runwayBuckets[4].count++;
      });

      return {
        products: productsWithSales.sort((a: any, b: any) => a.runway - b.runway).slice(0, 20),
        stats: { avgRunway, reorderNeeded, stockoutRisk },
        chartData: runwayBuckets,
        allProducts: products,
      };
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Timeline & Forecasting</h2>
            <p className="text-muted-foreground">Stock runway projections and reorder planning</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Forecast Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={dateRange}
                      onSelect={(range: any) => setDateRange(range)}
                      numberOfMonths={2}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Velocity Calculation</label>
                <Select value={velocityPeriod} onValueChange={(v) => setVelocityPeriod(v as "7d" | "14d" | "30d")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="14d">Last 14 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Stock Runway</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{forecastData?.stats.avgRunway || 0} days</div>
                  <p className="text-xs text-muted-foreground">Average across active products</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reorder Needed</CardTitle>
              <Package className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-orange-500">{forecastData?.stats.reorderNeeded || 0}</div>
                  <p className="text-xs text-muted-foreground">Products below reorder point</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stockout Risk</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-red-500">{forecastData?.stats.stockoutRisk || 0}</div>
                  <p className="text-xs text-muted-foreground">Products at risk in next 7 days</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Stock Runway Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={forecastData?.chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 'Number of Products', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar dataKey="count" name="Products" radius={[4, 4, 0, 0]}>
                    {forecastData?.chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Critical Products - Priority Reorder List</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : forecastData?.products && forecastData.products.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Velocity/Day</TableHead>
                    <TableHead className="text-right">Runway</TableHead>
                    <TableHead>Projected Stockout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecastData.products.map((product: any) => (
                    <TableRow key={product.sku}>
                      <TableCell>
                        {product.status === 'critical' ? (
                          <Badge variant="destructive">Critical</Badge>
                        ) : product.status === 'warning' ? (
                          <Badge className="bg-orange-500">Warning</Badge>
                        ) : (
                          <Badge variant="outline">Good</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-right">{product.available}</TableCell>
                      <TableCell className="text-right">{product.velocity}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {product.runway} days
                      </TableCell>
                      <TableCell>
                        {format(product.stockoutDate, 'MMM dd, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  {forecastData?.allProducts && forecastData.allProducts.length > 0 ? (
                    <>
                      <p className="font-semibold">{forecastData.allProducts.length} products in stock</p>
                      <p className="text-sm">No sales in the last {velocityPeriod === '7d' ? '7' : velocityPeriod === '14d' ? '14' : '30'} days</p>
                      <p className="text-xs mt-2">Try selecting a different velocity period</p>
                    </>
                  ) : (
                    <>
                      <p>No inventory data available</p>
                      <p className="text-sm">Import products and orders to see forecasts</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Timeline;
