import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Orders() {
  const [isImporting, setIsImporting] = useState(false);

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("placed_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const { data: importLogs } = useQuery({
    queryKey: ["import-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_logs")
        .select("*")
        .eq("import_type", "shopify_orders")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  const handleImport = async () => {
    setIsImporting(true);
    toast.info("Starting Shopify order import...");

    try {
      const { data, error } = await supabase.functions.invoke("shopify-import-orders");

      if (error) throw error;

      toast.success(
        `Import completed! ${data.records_imported} orders imported, ${data.records_failed} failed.`
      );
      refetch();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import orders. Check console for details.");
    } finally {
      setIsImporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      paid: "default",
      pending: "secondary",
      cancelled: "destructive",
      refunded: "outline",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getFulfillmentBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      fulfilled: "default",
      unfulfilled: "secondary",
      partial: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Orders</h2>
          <p className="text-muted-foreground">
            Manage and view all orders from Shopify
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Import Orders</CardTitle>
                <CardDescription>
                  Import historical orders from Shopify (last 2 years)
                </CardDescription>
              </div>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Import from Shopify
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {importLogs && importLogs.length > 0 && (
            <CardContent>
              <div className="text-sm space-y-2">
                <p className="font-medium">Recent Imports:</p>
                {importLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span>
                      {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={log.status === "completed" ? "default" : "secondary"}>
                        {log.status}
                      </Badge>
                      <span className="text-muted-foreground">
                        {log.records_imported} imported, {log.records_failed} failed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <CardDescription>
              {orders?.length || 0} orders total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fulfillment</TableHead>
                  <TableHead>New Customer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : orders && orders.length > 0 ? (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.customer_name}</div>
                          <div className="text-sm text-muted-foreground">{order.customer_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.placed_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {order.currency} {Number(order.total_amount).toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>{getFulfillmentBadge(order.fulfillment_status)}</TableCell>
                      <TableCell>
                        {order.is_new_customer ? (
                          <Badge variant="default">New</Badge>
                        ) : (
                          <Badge variant="outline">Returning</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No orders found. Click "Import from Shopify" to import orders.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
