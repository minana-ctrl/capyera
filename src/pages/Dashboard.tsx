import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Package2, ShoppingCart, DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { useState } from "react";
import { subDays } from "date-fns";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Today's sales metrics
  const { data: todayStats, isLoading: salesLoading } = useQuery({
    queryKey: ["sales-today"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .gte("placed_at", today.toISOString());

      const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
      const productRevenue = orders?.reduce((sum, o) => sum + Number(o.product_revenue), 0) || 0;
      const shippingRevenue = orders?.reduce((sum, o) => sum + Number(o.shipping_cost), 0) || 0;
      const orderCount = orders?.length || 0;
      const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const { data: yesterdayOrders } = await supabase
        .from("orders")
        .select("total_amount")
        .gte("placed_at", yesterday.toISOString())
        .lt("placed_at", today.toISOString());

      const yesterdayRevenue = yesterdayOrders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
      const revenueChange = yesterdayRevenue > 0 
        ? ((totalRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 
        : 0;

      return {
        totalRevenue,
        productRevenue,
        shippingRevenue,
        orderCount,
        avgOrderValue,
        revenueChange,
      };
    },
    refetchInterval: 300000, // Auto-refresh every 5 minutes
  });

  const { data: topProducts } = useQuery({
    queryKey: ["top-products-today"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data } = await supabase
        .from("order_line_items")
        .select(`
          sku,
          product_name,
          quantity,
          total_price,
          products (
            name,
            image_url
          )
        `)
        .gte("created_at", today.toISOString());

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

  const { data: categories } = useQuery({
    queryKey: ["category-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select(`
          id,
          name,
          products (
            id
          )
        `);
      
      if (error) throw error;
      return data?.map(cat => ({
        ...cat,
        productCount: cat.products?.length || 0
      }));
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

        {/* System Overview */}
        <div>
          <h3 className="text-lg font-semibold mb-3">System Overview</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {systemCards.map((stat) => (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
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
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Sales Analytics
              </CardTitle>
              <DateRangeFilter onDateChange={(from, to) => setDateRange({ from, to })} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center border-2 border-dashed rounded-lg">
              <div className="text-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Sales trend chart coming soon</p>
                <p className="text-sm">Toggleable between Revenue and Units Sold</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package2 className="h-5 w-5" />
              Category Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {categories?.slice(0, 6).map((category) => (
                <Card key={category.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{category.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {category.productCount} products
                        </p>
                      </div>
                      <Badge variant="outline">{category.productCount}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
