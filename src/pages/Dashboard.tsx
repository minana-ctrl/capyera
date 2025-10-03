import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Package2, ShoppingCart, DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { useState } from "react";
import { subDays, format, eachDayOfInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const Dashboard = () => {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [chartMetric, setChartMetric] = useState<'revenue' | 'units'>('revenue');

  // Today's sales metrics - using local timezone date boundaries
  const { data: todayStats, isLoading: salesLoading } = useQuery({
    queryKey: ["sales-today"],
    queryFn: async () => {
      // Get today's date at midnight in user's local timezone
      const now = new Date();
      const localToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const localTodayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      
      // Convert to UTC for database query
      const todayStart = new Date(localToday.getTime() - localToday.getTimezoneOffset() * 60000).toISOString();
      const todayEnd = new Date(localTodayEnd.getTime() - localTodayEnd.getTimezoneOffset() * 60000).toISOString();
      
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .gte("placed_at", todayStart)
        .lt("placed_at", todayEnd);

      const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
      const productRevenue = orders?.reduce((sum, o) => sum + Number(o.product_revenue), 0) || 0;
      const shippingRevenue = orders?.reduce((sum, o) => sum + Number(o.shipping_cost), 0) || 0;
      const orderCount = orders?.length || 0;
      const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

      // Get yesterday's date
      const localYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayStart = new Date(localYesterday.getTime() - localYesterday.getTimezoneOffset() * 60000).toISOString();
      
      const { data: yesterdayOrders } = await supabase
        .from("orders")
        .select("total_amount")
        .gte("placed_at", yesterdayStart)
        .lt("placed_at", todayStart);

      const yesterdayRevenue = yesterdayOrders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
      const revenueChange = yesterdayRevenue > 0 
        ? ((totalRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 
        : totalRevenue > 0 ? 100 : 0;

      return {
        totalRevenue,
        productRevenue,
        shippingRevenue,
        orderCount,
        avgOrderValue,
        revenueChange,
        yesterdayRevenue, // Include for debugging
      };
    },
    refetchInterval: 300000, // Auto-refresh every 5 minutes
  });

  const { data: topProducts } = useQuery({
    queryKey: ["top-products-today"],
    queryFn: async () => {
      // Use same date calculation as todayStats for consistency
      const now = new Date();
      const localToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const localTodayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const todayStart = new Date(localToday.getTime() - localToday.getTimezoneOffset() * 60000).toISOString();
      const todayEnd = new Date(localTodayEnd.getTime() - localTodayEnd.getTimezoneOffset() * 60000).toISOString();
      
      const { data } = await supabase
        .from("order_line_items")
        .select(`
          sku,
          product_name,
          quantity,
          total_price
        `)
        .gte("created_at", todayStart)
        .lt("created_at", todayEnd);

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

  const { data: salesTrend, isLoading: trendLoading } = useQuery({
    queryKey: ["sales-trend", dateRange],
    queryFn: async () => {
      // Adjust date range boundaries to local timezone
      const fromDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate());
      const toDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate() + 1);
      
      const fromISO = new Date(fromDate.getTime() - fromDate.getTimezoneOffset() * 60000).toISOString();
      const toISO = new Date(toDate.getTime() - toDate.getTimezoneOffset() * 60000).toISOString();
      
      const { data: orders } = await supabase
        .from("orders")
        .select("placed_at, total_amount")
        .gte("placed_at", fromISO)
        .lt("placed_at", toISO)
        .order("placed_at");

      const { data: lineItems } = await supabase
        .from("order_line_items")
        .select("created_at, quantity")
        .gte("created_at", fromISO)
        .lt("created_at", toISO);

      // Create daily buckets using local dates
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const dailyData = days.map(day => {
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
        
        const dayOrders = orders?.filter(o => {
          const orderDate = new Date(o.placed_at);
          return orderDate >= dayStart && orderDate < dayEnd;
        }) || [];
        
        const dayItems = lineItems?.filter(i => {
          const itemDate = new Date(i.created_at);
          return itemDate >= dayStart && itemDate < dayEnd;
        }) || [];

        return {
          date: format(day, 'MMM dd'),
          revenue: dayOrders.reduce((sum, o) => sum + Number(o.total_amount), 0),
          units: dayItems.reduce((sum, i) => sum + i.quantity, 0),
        };
      });

      return dailyData;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["category-stats", dateRange],
    queryFn: async () => {
      const { data: categories } = await supabase
        .from("categories")
        .select("id, name");

      if (!categories) return [];

      // Adjust date range to local timezone
      const fromDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate());
      const toDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate() + 1);
      const fromISO = new Date(fromDate.getTime() - fromDate.getTimezoneOffset() * 60000).toISOString();
      const toISO = new Date(toDate.getTime() - toDate.getTimezoneOffset() * 60000).toISOString();

      // Get sales per category in date range using SKU matching
      const categoryStats = await Promise.all(
        categories.map(async (cat) => {
          const { data: products } = await supabase
            .from("products")
            .select("sku")
            .eq("category_id", cat.id);

          const productSkus = products?.map(p => p.sku) || [];

          if (productSkus.length === 0) {
            return { ...cat, revenue: 0, units: 0 };
          }

          const { data: lineItems } = await supabase
            .from("order_line_items")
            .select("quantity, total_price")
            .in("sku", productSkus)
            .gte("created_at", fromISO)
            .lt("created_at", toISO);

          const revenue = lineItems?.reduce((sum, i) => sum + Number(i.total_price), 0) || 0;
          const units = lineItems?.reduce((sum, i) => sum + i.quantity, 0) || 0;

          return { ...cat, revenue, units };
        })
      );

      return categoryStats.filter(c => c.revenue > 0 || c.units > 0)
        .sort((a, b) => b.revenue - a.revenue);
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
      icon: Package2,
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <p className="text-muted-foreground">
              Real-time overview • Last updated: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Today's Sales Metrics */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Today's Sales Performance</h3>
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
                      {Math.abs(todayStats?.revenueChange || 0).toFixed(1)}% vs yesterday
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


        {/* Top Products Today */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Products by Units Sold (Today)</CardTitle>
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
                <p className="text-center text-muted-foreground py-8">No sales data yet today</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Products by Revenue (Today)</CardTitle>
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
                <p className="text-center text-muted-foreground py-8">No sales data yet today</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Sales Trend
              </CardTitle>
              <div className="flex items-center gap-4">
                <Tabs value={chartMetric} onValueChange={(v) => setChartMetric(v as 'revenue' | 'units')}>
                  <TabsList>
                    <TabsTrigger value="revenue">Revenue</TabsTrigger>
                    <TabsTrigger value="units">Units Sold</TabsTrigger>
                  </TabsList>
                </Tabs>
                <DateRangeFilter onDateChange={(from, to) => setDateRange({ from, to })} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : !salesTrend || salesTrend.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No sales data available for selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => 
                      chartMetric === 'revenue' ? `$${value.toFixed(0)}` : value
                    }
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                    formatter={(value: number) => 
                      chartMetric === 'revenue' ? `$${value.toFixed(2)}` : value
                    }
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey={chartMetric} 
                    name={chartMetric === 'revenue' ? 'Revenue' : 'Units Sold'}
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package2 className="h-5 w-5" />
              Category Performance (Selected Period)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : categories && categories.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categories.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Legend />
                  <Bar 
                    dataKey="revenue" 
                    name="Revenue"
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No category data available for selected period
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
