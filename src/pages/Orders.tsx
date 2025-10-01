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
  const [isNormalImporting, setIsNormalImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    step: 'idle' | 'starting' | 'polling' | 'processing' | 'complete';
    message: string;
    operationId?: string;
    url?: string;
    objectCount?: number;
  }>({ step: 'idle', message: '' });

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

  const handleNormalImport = async () => {
    console.log("=== Import button clicked ===");
    setIsNormalImporting(true);
    toast.info("Starting order import with pagination...");

    try {
      console.log("Calling shopify-import-orders edge function...");
      const { data, error } = await supabase.functions.invoke(
        "shopify-import-orders",
        { body: { maxPages: 200 } } // Allow up to 200 pages (50,000 orders)
      );

      console.log("Edge function response:", { data, error });

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }

      console.log("Import completed successfully:", data);
      toast.success(
        `Import completed! ${data.records_imported} orders imported, ${data.records_failed || 0} failed.`
      );
      refetch();
    } catch (error: any) {
      console.error("Normal import error:", error);
      toast.error(`Failed to import orders: ${error?.message || 'Unknown error'}`);
    } finally {
      console.log("Import process finished, resetting state");
      setIsNormalImporting(false);
    }
  };

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
                <Button onClick={handleNormalImport} disabled={isNormalImporting || isImporting}>
                  {isNormalImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Import Orders
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          {isNormalImporting && (
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant="secondary">Importing</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Fetching orders with rate limiting (750ms between requests)...
                </p>
              </div>
            </CardContent>
          )}
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
