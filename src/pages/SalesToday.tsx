import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Package, ShoppingCart, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const SalesToday = () => {
  const { data: todayStats, isLoading } = useQuery({
    queryKey: ["sales-today"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get today's orders
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .gte("placed_at", today.toISOString());

      const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
      const productRevenue = orders?.reduce((sum, o) => sum + Number(o.product_revenue), 0) || 0;
      const shippingRevenue = orders?.reduce((sum, o) => sum + Number(o.shipping_cost), 0) || 0;
      const orderCount = orders?.length || 0;
      const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

      // Get yesterday's data for comparison
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
        orders: orders || []
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

      // Aggregate by SKU
      const aggregated = data?.reduce((acc: any, item) => {
        if (!acc[item.sku]) {
          acc[item.sku] = {
            sku: item.sku,
            name: item.product_name,
            units: 0,
            revenue: 0,
            image: item.products?.image_url
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

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Sales Today</h2>
            <p className="text-muted-foreground">
              Real-time snapshot of today's performance • Last updated: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
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
              {isLoading ? (
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
              {isLoading ? (
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
              {isLoading ? (
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
              {isLoading ? (
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

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Products by Units Sold</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
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
              <CardTitle>Top Products by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
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
      </div>
    </DashboardLayout>
  );
};

export default SalesToday;
