import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Package2, ShoppingCart, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard = () => {
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
            <CardTitle className="flex items-center gap-2">
              Welcome to Capiera Inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Your inventory management system is fully operational with {stats?.products || 0} products 
              and {stats?.bundles || 0} bundle configurations loaded and ready.
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Quick Actions:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• View and manage products in the Products section</li>
                <li>• Configure bundles in the Bundles section</li>
                <li>• Track inventory across warehouses</li>
                <li>• Process sales orders and manage suppliers</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
