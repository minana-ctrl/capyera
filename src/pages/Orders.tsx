import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, Webhook, Upload } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ImportOrdersDialog } from "@/components/ImportOrdersDialog";

export default function Orders() {
  const [isImporting, setIsImporting] = useState(false);
  const [isSettingUpWebhooks, setIsSettingUpWebhooks] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [importStatus, setImportStatus] = useState<{
    step: 'idle' | 'starting' | 'polling' | 'processing' | 'complete';
    message: string;
    operationId?: string;
    url?: string;
    objectCount?: number;
  }>({ step: 'idle', message: '' });

  const ORDERS_PER_PAGE = 50;

  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ["orders", dateRange.from.toISOString(), dateRange.to.toISOString(), page],
    queryFn: async () => {
      const PACIFIC_TZ = 'America/Los_Angeles';
      
      const getPacificStartOfDay = (date: Date) => {
        const pacificDate = toZonedTime(date, PACIFIC_TZ);
        const year = pacificDate.getFullYear();
        const month = String(pacificDate.getMonth() + 1).padStart(2, '0');
        const day = String(pacificDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}T00:00:00`;
        return fromZonedTime(dateStr, PACIFIC_TZ);
      };

      const getPacificEndOfDay = (date: Date) => {
        const pacificDate = toZonedTime(date, PACIFIC_TZ);
        const year = pacificDate.getFullYear();
        const month = String(pacificDate.getMonth() + 1).padStart(2, '0');
        const day = String(pacificDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}T23:59:59.999`;
        return fromZonedTime(dateStr, PACIFIC_TZ);
      };

      // Use Pacific time for date range filtering
      const fromISO = getPacificStartOfDay(dateRange.from).toISOString();
      const toISO = getPacificEndOfDay(dateRange.to).toISOString();

      // First get total count for pagination
      const { count } = await supabase
        .from("orders")
        .select("*", { count: 'exact', head: true })
        .gte("placed_at", fromISO)
        .lte("placed_at", toISO);

      // Then fetch paginated orders with line items
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_line_items (
            id,
            product_id,
            product_name,
            sku,
            quantity,
            unit_price,
            total_price
          )
        `)
        .gte("placed_at", fromISO)
        .lte("placed_at", toISO)
        .order("placed_at", { ascending: false })
        .range(page * ORDERS_PER_PAGE, (page + 1) * ORDERS_PER_PAGE - 1);

      if (error) throw error;
      return { orders: data, totalCount: count || 0 };
    },
  });

  const orders = ordersData?.orders;
  const totalPages = ordersData ? Math.ceil(ordersData.totalCount / ORDERS_PER_PAGE) : 0;

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


  const handleBulkImport = async () => {
    setIsImporting(true);
    
    try {
      // Step 1: Start bulk operation
      setImportStatus({ step: 'starting', message: 'Starting bulk export from Shopify...' });
      toast.info("Starting bulk export...");

      const { data: startData, error: startError } = await supabase.functions.invoke(
        "shopify-bulk-import",
        { body: { action: 'start' } }
      );

      if (startError) throw startError;

      const operationId = startData.operation_id;
      setImportStatus({ 
        step: 'polling', 
        message: 'Waiting for Shopify to prepare data...', 
        operationId 
      });
      toast.info("Bulk export started. Waiting for completion...");

      // Step 2: Poll for completion (check every 10 seconds)
      let completed = false;
      let url = '';
      let objectCount = 0;

      while (!completed) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s

        const { data: checkData, error: checkError } = await supabase.functions.invoke(
          "shopify-bulk-import",
          { body: { action: 'check' } }
        );

        if (checkError) throw checkError;

        setImportStatus({
          step: 'polling',
          message: `Status: ${checkData.status} - ${checkData.object_count || 0} objects prepared`,
          operationId,
          objectCount: checkData.object_count
        });

        if (checkData.status === 'COMPLETED') {
          completed = true;
          url = checkData.url;
          objectCount = checkData.object_count;
          toast.success(`Export complete! ${objectCount} objects ready for import.`);
        } else if (checkData.status === 'FAILED') {
          const code = checkData.error_code || 'UNKNOWN_ERROR';
          throw new Error(`Bulk operation failed (${code})`);
        }
      }

      // Step 3: Process and import
      setImportStatus({ 
        step: 'processing', 
        message: `Importing ${objectCount} records...`, 
        operationId,
        url,
        objectCount
      });
      toast.info("Downloading and importing orders...");

      const { data: processData, error: processError } = await supabase.functions.invoke(
        "shopify-bulk-import",
        { body: { action: 'process', url, operation_id: operationId } }
      );

      if (processError) throw processError;

      setImportStatus({
        step: 'complete',
        message: `Import completed! ${processData.records_imported} orders imported, ${processData.records_failed} failed.`,
        objectCount: processData.records_imported
      });

      toast.success(
        `Import completed! ${processData.records_imported} orders imported.`
      );
      
      refetch();
    } catch (error: any) {
      console.error("Bulk import error:", error);
      toast.error(`Failed to import orders: ${error?.message || 'Unknown error'}`);
      setImportStatus({
        step: 'idle',
        message: 'Import failed. Please try again.'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearOrders = async () => {
    if (!confirm("Are you sure you want to delete ALL orders? This action cannot be undone.")) {
      return;
    }

    setIsClearing(true);
    toast.info("Clearing all orders...");

    try {
      const { error } = await supabase.functions.invoke("clear-orders");

      if (error) throw error;

      toast.success("All orders cleared successfully!");
      refetch();
    } catch (error: any) {
      console.error("Clear orders error:", error);
      toast.error(`Failed to clear orders: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsClearing(false);
    }
  };

  const handleSetupWebhooks = async () => {
    setIsSettingUpWebhooks(true);
    toast.info("Setting up Shopify webhooks...");

    try {
      const { data, error } = await supabase.functions.invoke("setup-shopify-webhooks");

      if (error) throw error;

      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      const alreadyExistCount = data.results?.filter((r: any) => 
        !r.success && r.errors?.[0]?.message?.includes("already been taken")
      ).length || 0;
      const totalCount = data.results?.length || 0;

      if (successCount === totalCount) {
        toast.success(`All ${successCount} webhooks configured successfully!`);
      } else if (successCount + alreadyExistCount === totalCount) {
        toast.success(
          `Webhooks ready! ${successCount} newly created, ${alreadyExistCount} already configured.`
        );
      } else if (successCount > 0) {
        toast.warning(`${successCount}/${totalCount} webhooks configured. Check console for details.`);
      } else if (alreadyExistCount === totalCount) {
        toast.success("All webhooks are already configured and active!");
      } else {
        toast.error("Failed to configure webhooks. Check your Shopify credentials.");
      }

      console.log("Webhook setup results:", data);
    } catch (error: any) {
      console.error("Webhook setup error:", error);
      toast.error(`Failed to setup webhooks: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSettingUpWebhooks(false);
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
                <CardTitle>Import from Shopify</CardTitle>
                <CardDescription>
                  Import all historical orders (last 2 years) using paginated API calls
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleClearOrders} disabled={isClearing || isImporting} variant="destructive">
                  {isClearing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    "Clear Orders"
                  )}
                </Button>
                <Button onClick={() => setCsvImportOpen(true)} variant="outline" disabled={isImporting}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              </div>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Live Webhook Integration</CardTitle>
                <CardDescription>
                  Configure Shopify webhooks to automatically sync new orders in real-time
                </CardDescription>
              </div>
              <Button 
                onClick={handleSetupWebhooks} 
                disabled={isSettingUpWebhooks}
                variant="outline"
              >
                {isSettingUpWebhooks ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Webhook className="mr-2 h-4 w-4" />
                    Setup Webhooks
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>This will automatically register webhooks for:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Orders Created</strong> - Capture new orders and reserve inventory</li>
                <li><strong>Orders Fulfilled</strong> - Deduct inventory when shipped</li>
                <li><strong>Orders Cancelled</strong> - Release inventory reservations</li>
                <li><strong>Orders Updated</strong> - Sync order status changes</li>
              </ul>
              <p className="mt-4 text-xs">
                Webhook URL: <code className="bg-muted px-1 py-0.5 rounded">
                  {window.location.origin.replace(window.location.host, 'sjydlxpogzbaxgbufwnp.supabase.co')}/functions/v1/shopify-webhook
                </code>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Orders</CardTitle>
                <CardDescription>
                  Showing {orders?.length || 0} of {ordersData?.totalCount || 0} orders
                </CardDescription>
              </div>
              <DateRangeFilter onDateChange={(from, to) => {
                setDateRange({ from, to });
                setPage(0); // Reset to first page on date change
              }} />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fulfillment</TableHead>
                  <TableHead>New Customer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : orders && orders.length > 0 ? (
                  orders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.customer_name}</div>
                          <div className="text-sm text-muted-foreground">{order.customer_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatInTimeZone(new Date(order.placed_at), "UTC", "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {order.order_line_items?.map((item: any) => (
                            <div key={item.id} className="text-xs">
                              <div className="flex items-center gap-1">
                                <span className="font-medium">{item.product_name}</span>
                                {item.product_id ? (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">✓</Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-[10px] px-1 py-0">✗</Badge>
                                )}
                              </div>
                              <div className="text-muted-foreground">
                                SKU: {item.sku} × {item.quantity}
                              </div>
                            </div>
                          )) || <span className="text-muted-foreground">No items</span>}
                        </div>
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
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No orders found. Click "Import from Shopify" to import orders.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0 || isLoading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1 || isLoading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ImportOrdersDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        onSuccess={() => refetch()}
      />
    </DashboardLayout>
  );
}
