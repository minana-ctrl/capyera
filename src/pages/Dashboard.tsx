import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesTrendCard } from "@/components/dashboard/SalesTrendCard";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { useState } from "react";
import { DateRangeFilter } from "@/components/DateRangeFilter";

const Dashboard = () => {

  const PACIFIC_TZ = 'America/Los_Angeles';
  
  const getPacificStartOfDay = (date: Date) => {
    // Create a date string in Pacific time at midnight
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}T00:00:00`;
    // Convert Pacific midnight to UTC
    return fromZonedTime(dateStr, PACIFIC_TZ);
  };

  const getPacificEndOfDay = (date: Date) => {
    // Create a date string in Pacific time at end of day
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}T23:59:59.999`;
    // Convert Pacific end of day to UTC
    return fromZonedTime(dateStr, PACIFIC_TZ);
  };

  const [metricsDateRange, setMetricsDateRange] = useState({
    from: getPacificStartOfDay(new Date()),
    to: getPacificEndOfDay(new Date()),
  });

  // Sales metrics with date range filtering
  const { data: todayStats, isLoading: salesLoading } = useQuery({
    queryKey: ["sales-metrics", metricsDateRange.from.toISOString(), metricsDateRange.to.toISOString()],
    queryFn: async () => {
      const periodStart = metricsDateRange.from;
      const periodEnd = metricsDateRange.to;
      
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .gte("placed_at", periodStart.toISOString())
        .lte("placed_at", periodEnd.toISOString());

      const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
      const productRevenue = orders?.reduce((sum, o) => sum + Number(o.product_revenue), 0) || 0;
      const shippingRevenue = orders?.reduce((sum, o) => sum + Number(o.shipping_cost), 0) || 0;
      const orderCount = orders?.length || 0;
      const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

      // Calculate comparison period (same duration, ending before current period starts)
      const periodDuration = periodEnd.getTime() - periodStart.getTime();
      const comparisonEnd = new Date(periodStart);
      const comparisonStart = new Date(periodStart.getTime() - periodDuration);
      
      const { data: comparisonOrders } = await supabase
        .from("orders")
        .select("total_amount")
        .gte("placed_at", comparisonStart.toISOString())
        .lt("placed_at", comparisonEnd.toISOString());

      const comparisonRevenue = comparisonOrders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
      const revenueChange = comparisonRevenue > 0 
        ? ((totalRevenue - comparisonRevenue) / comparisonRevenue) * 100 
        : totalRevenue > 0 ? 100 : 0;

      return {
        totalRevenue,
        productRevenue,
        shippingRevenue,
        orderCount,
        avgOrderValue,
        revenueChange,
        comparisonRevenue,
      };
    },
  });

  const { data: topProducts } = useQuery({
    queryKey: ["top-products", metricsDateRange.from.toISOString(), metricsDateRange.to.toISOString()],
    queryFn: async () => {
      const periodStart = metricsDateRange.from;
      const periodEnd = metricsDateRange.to;
      
      // First get order IDs from selected period based on placed_at
      const { data: periodOrders } = await supabase
        .from("orders")
        .select("id")
        .gte("placed_at", periodStart.toISOString())
        .lte("placed_at", periodEnd.toISOString());

      const orderIds = periodOrders?.map(o => o.id) || [];

      if (orderIds.length === 0) {
        return { byUnits: [], byRevenue: [] };
      }

       const chunkSize = 100;
       const chunks = Array.from({ length: Math.ceil(orderIds.length / chunkSize) }, (_, i) =>
         orderIds.slice(i * chunkSize, (i + 1) * chunkSize)
       );
       const results = await Promise.all(
         chunks.map(async (ids) => {
           const { data } = await supabase
             .from("order_line_items")
             .select(`
               sku,
               product_name,
               quantity,
               total_price
             `)
             .in("order_id", ids);
           return data || [];
         })
       );

       const data = results.flat();

      const aggregated = data?.reduce((acc: any, item) => {
        if (!acc[item.sku]) {
          acc[item.sku] = {
            sku: item.sku,
            name: item.product_name,
            units: 0,
            revenue: 0,
          };
        }
        acc[item.sku].units += item.quantity;
        acc[item.sku].revenue += Number(item.total_price);
        return acc;
      }, {});

      const products = Object.values(aggregated || {}) as any[];
      return {
        byUnits: products.sort((a, b) => b.units - a.units).slice(0, 5),
        byRevenue: products.sort((a, b) => b.revenue - a.revenue).slice(0, 5)
      };
    },
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [productsRes, bundlesRes, warehousesRes, ordersRes] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("bundles").select("*", { count: "exact", head: true }),
        supabase.from("warehouses").select("*", { count: "exact", head: true }),
        supabase.from("sales_orders").select("*", { count: "exact", head: true }).eq("status", "draft"),
      ]);

      return {
        products: productsRes.count || 0,
        bundles: bundlesRes.count || 0,
        warehouses: warehousesRes.count || 0,
        pendingOrders: ordersRes.count || 0,
      };
    },
  });

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-green-500";
    if (change < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  const systemCards = [
    {
      title: "Total Products",
      value: stats?.products || 0,
      subtitle: "Active products",
      icon: Package,
      color: "text-blue-500",
    },
    {
      title: "Product Bundles",
      value: stats?.bundles || 0,
      subtitle: "Bundle configurations",
      icon: Package,
      color: "text-purple-500",
    },
    {
      title: "Warehouses",
      value: stats?.warehouses || 0,
      subtitle: "Active locations",
      icon: Package,
      color: "text-green-500",
    },
    {
      title: "Pending Orders",
      value: stats?.pendingOrders || 0,
      subtitle: "Draft sales orders",
      icon: ShoppingCart,
      color: "text-orange-500",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <p className="text-muted-foreground">
              Real-time overview • Last updated: {new Date().toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DateRangeFilter
              onDateChange={(from, to) => setMetricsDateRange({ from, to })}
            />
          </div>
        </div>

        {/* Sales Performance Metrics */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Sales Performance</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-3xl font-bold">${todayStats?.totalRevenue.toFixed(2)}</div>
                    <div className={`flex items-center gap-1 text-xs ${getChangeColor(todayStats?.revenueChange || 0)}`}>
                      {getChangeIcon(todayStats?.revenueChange || 0)}
                      {Math.abs(todayStats?.revenueChange || 0).toFixed(1)}% vs previous period
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Product Revenue</CardTitle>
                <Package className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-3xl font-bold">${todayStats?.productRevenue.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Excluding shipping</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Shipping Revenue</CardTitle>
                <DollarSign className="h-5 w-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-3xl font-bold">${todayStats?.shippingRevenue.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Shipping collected</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <ShoppingCart className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-3xl font-bold">{todayStats?.orderCount}</div>
                    <p className="text-xs text-muted-foreground">Orders placed</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
                <TrendingUp className="h-5 w-5 text-cyan-500" />
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-3xl font-bold">${todayStats?.avgOrderValue.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Per order</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>


        {/* Top Products for Selected Period */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Products by Units Sold</CardTitle>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : topProducts?.byUnits && topProducts.byUnits.length > 0 ? (
                <div className="space-y-3">
                  {topProducts.byUnits.map((product: any, idx: number) => (
                    <div key={product.sku} className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{product.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{product.units} units</p>
                        <p className="text-sm text-muted-foreground">${product.revenue.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No sales data for selected period</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Products by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : topProducts?.byRevenue && topProducts.byRevenue.length > 0 ? (
                <div className="space-y-3">
                  {topProducts.byRevenue.map((product: any, idx: number) => (
                    <div key={product.sku} className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{product.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">${product.revenue.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">{product.units} units</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No sales data for selected period</p>
              )}
            </CardContent>
          </Card>
        </div>

        <SalesTrendCard />

      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
