import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Package2, ShoppingCart, AlertTriangle, TrendingUp } from "lucide-react";
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

  const statCards = [
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
        <div>
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">Overview of your inventory system</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
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
