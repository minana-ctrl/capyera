import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload } from "lucide-react";

interface ImportOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ImportOrdersDialog = ({ open, onOpenChange, onSuccess }: ImportOrdersDialogProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleImport = async () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select CSV files to import",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      let totalOrdersImported = 0;
      let totalLineItemsImported = 0;

      // Clear data before first import
      toast({
        title: "Clearing existing data...",
        description: "This may take a moment",
      });

      await supabase.functions.invoke('import-orders-csv', {
        body: { csvData: [], clearData: true }
      });

      // Process files one at a time
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        toast({
          title: `Processing file ${i + 1} of ${files.length}`,
          description: file.name,
        });

        const csvText = await file.text();

        const { data, error } = await supabase.functions.invoke('import-orders-csv', {
          body: { csvData: [csvText], clearData: false }
        });

        if (error) throw error;

        totalOrdersImported += data.ordersImported || 0;
        totalLineItemsImported += data.lineItemsImported || 0;
      }

      toast({
        title: "Import successful",
        description: `Imported ${totalOrdersImported} orders with ${totalLineItemsImported} line items`,
      });

      onSuccess();
      onOpenChange(false);
      setFiles([]);
    } catch (error: any) {
      console.error('Import error:', error);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Orders from CSV</DialogTitle>
          <DialogDescription>
            Upload Shopify order export CSV files. This will replace all existing order data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="csv-files">CSV Files</Label>
            <Input
              id="csv-files"
              type="file"
              accept=".csv"
              multiple
              onChange={handleFilesChange}
              disabled={isLoading}
            />
            {files.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {files.length} file(s) selected
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isLoading || files.length === 0}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import Orders
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
