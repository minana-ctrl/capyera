import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ImportInventoryDialog = ({ open, onOpenChange, onSuccess }: ImportInventoryDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "text/csv" || selectedFile.name.endsWith(".csv")) {
        setFile(selectedFile);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file",
          variant: "destructive",
        });
      }
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || "";
      });
      rows.push(row);
    }

    return rows;
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to import",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        throw new Error("No valid data found in CSV");
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create import log
      const { data: importLog, error: logError } = await supabase
        .from("import_logs")
        .insert({
          import_type: "inventory",
          file_name: file.name,
          status: "pending",
          imported_by: user?.id,
          records_imported: 0,
          records_failed: 0,
        })
        .select()
        .single();

      if (logError) throw logError;

      let imported = 0;
      let failed = 0;
      const errors: any[] = [];

      // Process each row
      for (const row of rows) {
        try {
          // Expected CSV format: sku, warehouse_name, quantity, par_level, reorder_point
          const { sku, warehouse_name, quantity, par_level, reorder_point } = row;

          if (!sku || !warehouse_name || !quantity) {
            throw new Error("Missing required fields");
          }

          // Find product by SKU
          const { data: product, error: productError } = await supabase
            .from("products")
            .select("id")
            .eq("sku", sku)
            .single();

          if (productError) throw new Error(`Product not found for SKU: ${sku}`);

          // Find warehouse by name
          const { data: warehouse, error: warehouseError } = await supabase
            .from("warehouses")
            .select("id")
            .ilike("name", warehouse_name)
            .single();

          if (warehouseError) throw new Error(`Warehouse not found: ${warehouse_name}`);

          // Check if stock record exists
          const { data: existingStock } = await supabase
            .from("warehouse_stock")
            .select("id, quantity")
            .eq("product_id", product.id)
            .eq("warehouse_id", warehouse.id)
            .single();

          const newQuantity = parseInt(quantity);

          if (existingStock) {
            // Update existing stock (add to current quantity)
            await supabase
              .from("warehouse_stock")
              .update({
                quantity: existingStock.quantity + newQuantity,
                available_stock: existingStock.quantity + newQuantity,
                par_level: par_level ? parseInt(par_level) : existingStock.quantity,
                reorder_point: reorder_point ? parseInt(reorder_point) : undefined,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingStock.id);
          } else {
            // Create new stock record
            await supabase
              .from("warehouse_stock")
              .insert({
                product_id: product.id,
                warehouse_id: warehouse.id,
                quantity: newQuantity,
                available_stock: newQuantity,
                par_level: par_level ? parseInt(par_level) : 0,
                reorder_point: reorder_point ? parseInt(reorder_point) : 0,
              });
          }

          // Create stock movement record
          await supabase
            .from("stock_movements")
            .insert({
              product_id: product.id,
              warehouse_id: warehouse.id,
              quantity: newQuantity,
              movement_type: "inbound",
              reference_type: "import",
              reference_id: importLog.id,
              created_by: user?.id,
              notes: `Imported from ${file.name}`,
            });

          imported++;
        } catch (error: any) {
          failed++;
          errors.push({ row, error: error.message });
        }
      }

      // Update import log
      await supabase
        .from("import_logs")
        .update({
          status: failed > 0 ? "partial" : "completed",
          records_imported: imported,
          records_failed: failed,
          error_log: errors.length > 0 ? errors : null,
        })
        .eq("id", importLog.id);

      toast({
        title: "Import completed",
        description: `Successfully imported ${imported} records. ${failed > 0 ? `${failed} records failed.` : ""}`,
      });

      onSuccess();
      onOpenChange(false);
      setFile(null);
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Inventory
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to import inventory levels. The system will update existing stock records or create new ones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>CSV Format:</strong> sku, warehouse_name, quantity, par_level, reorder_point
              <br />
              <span className="text-xs text-muted-foreground">
                Example: PROD-001, Main Warehouse, 100, 50, 25
              </span>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <div className="flex items-center gap-2">
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isLoading}
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="h-4 w-4" />
                  {file.name}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || isLoading}>
            {isLoading ? "Importing..." : "Import Inventory"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
