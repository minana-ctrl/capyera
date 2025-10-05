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

// Helper: split CSV into safe chunks with header replicated
function splitCsvIntoChunksWithHeader(csv: string, maxChunkSize = 750000): string[] {
  // Find header row end respecting quotes
  let inQuotes = false;
  let headerEnd = -1;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    const next = csv[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') { i++; continue; }
      inQuotes = !inQuotes;
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      // handle \r\n
      headerEnd = c === '\r' && next === '\n' ? i + 2 : i + 1;
      break;
    }
  }
  if (headerEnd === -1) return [csv];
  const header = csv.slice(0, headerEnd);
  const body = csv.slice(headerEnd);

  const chunks: string[] = [];
  let chunkBody = '';
  inQuotes = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    const next = body[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') { chunkBody += '"'; i++; continue; }
      inQuotes = !inQuotes;
      chunkBody += c;
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      // row boundary
      // include CRLF fully
      if (c === '\r' && next === '\n') { chunkBody += '\r\n'; i++; } else { chunkBody += c; }
      if (chunkBody.length >= maxChunkSize) {
        chunks.push(header + chunkBody);
        chunkBody = '';
      }
    } else {
      chunkBody += c;
    }
  }
  if (chunkBody.trim().length > 0) {
    chunks.push(header + chunkBody);
  }
  return chunks.length ? chunks : [csv];
}

export const ImportOrdersDialog = ({ open, onOpenChange, onSuccess }: ImportOrdersDialogProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
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
    setIsCancelled(false);

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

      // Check for cancellation
      if (isCancelled) {
        toast({
          title: "Import cancelled",
          description: "Data was cleared but no files were imported",
        });
        return;
      }

      // Process files one at a time
      for (let i = 0; i < files.length; i++) {
        // Check for cancellation before processing each file
        if (isCancelled) {
          toast({
            title: "Import cancelled",
            description: `Imported ${totalOrdersImported} orders from ${i} of ${files.length} files before cancellation`,
          });
          return;
        }

        const file = files[i];
        
        toast({
          title: `Processing file ${i + 1} of ${files.length}`,
          description: file.name,
        });

        const csvText = await file.text();
        const parts = splitCsvIntoChunksWithHeader(csvText, 700_000);

        for (let p = 0; p < parts.length; p++) {
          // Early cancellation check between chunks
          if (isCancelled) break;

          const { data, error } = await supabase.functions.invoke('import-orders-csv', {
            body: { csvData: [parts[p]], clearData: false }
          });
          if (error) throw error;
          totalOrdersImported += data.ordersImported || 0;
          totalLineItemsImported += data.lineItemsImported || 0;

          toast({
            title: `Imported chunk ${p + 1}/${parts.length} from ${file.name}`,
            description: `${totalOrdersImported} orders / ${totalLineItemsImported} items so far`,
          });
        }
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
      setIsCancelled(false);
    }
  };

  const handleCancel = () => {
    setIsCancelled(true);
    toast({
      title: "Cancelling import...",
      description: "Current file will finish, then import will stop",
    });
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
          {isLoading ? (
            <Button variant="destructive" onClick={handleCancel} disabled={isCancelled}>
              {isCancelled ? "Stopping..." : "Stop Import"}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={files.length === 0}>
                <Upload className="mr-2 h-4 w-4" />
                Import Orders
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
