import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Minus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdjustInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    name: string;
    sku: string;
    current_level: number;
    warehouse_id: string;
  } | null;
  onSuccess?: () => void;
}

export function AdjustInventoryDialog({ open, onOpenChange, product, onSuccess }: AdjustInventoryDialogProps) {
  const [quantity, setQuantity] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  if (!product) return null;

  const handleAdjustment = async (type: 'add' | 'remove' | 'set') => {
    if (!quantity || isNaN(Number(quantity)) || Number(quantity) < 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const qty = Number(quantity);
      let newQuantity: number;
      let movementType: string;

      switch (type) {
        case 'add':
          newQuantity = product.current_level + qty;
          movementType = 'inbound';
          break;
        case 'remove':
          newQuantity = Math.max(0, product.current_level - qty);
          movementType = 'adjustment';
          break;
        case 'set':
          newQuantity = qty;
          movementType = 'adjustment';
          break;
      }

      // Update warehouse stock
      const { error: updateError } = await supabase
        .from("warehouse_stock")
        .update({
          quantity: newQuantity,
          available_stock: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq("product_id", product.id)
        .eq("warehouse_id", product.warehouse_id);

      if (updateError) throw updateError;

      // Log stock movement
      const { error: logError } = await supabase
        .from("stock_movements")
        .insert({
          product_id: product.id,
          warehouse_id: product.warehouse_id,
          movement_type: movementType,
          quantity: type === 'remove' ? -qty : (type === 'add' ? qty : (newQuantity - product.current_level)),
          notes: notes || `Manual ${type} adjustment`,
        });

      if (logError) throw logError;

      toast({
        title: "Inventory adjusted",
        description: `${product.name} inventory updated successfully`,
      });

      setQuantity("");
      setNotes("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error adjusting inventory:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to adjust inventory",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Adjust Inventory
          </DialogTitle>
          <DialogDescription>
            {product.name} (SKU: {product.sku})
            <br />
            Current stock: <span className="font-semibold">{product.current_level} units</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="add" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="add">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </TabsTrigger>
            <TabsTrigger value="remove">
              <Minus className="h-4 w-4 mr-1" />
              Remove
            </TabsTrigger>
            <TabsTrigger value="set">
              <Package className="h-4 w-4 mr-1" />
              Set
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="add-quantity">Quantity to Add</Label>
              <Input
                id="add-quantity"
                type="number"
                min="0"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                New total: {product.current_level + (Number(quantity) || 0)} units
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-notes">Notes (optional)</Label>
              <Textarea
                id="add-notes"
                placeholder="Reason for adjustment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button
              onClick={() => handleAdjustment('add')}
              disabled={isLoading || !quantity}
              className="w-full"
            >
              Add Stock
            </Button>
          </TabsContent>

          <TabsContent value="remove" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="remove-quantity">Quantity to Remove</Label>
              <Input
                id="remove-quantity"
                type="number"
                min="0"
                max={product.current_level}
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                New total: {Math.max(0, product.current_level - (Number(quantity) || 0))} units
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="remove-notes">Notes (optional)</Label>
              <Textarea
                id="remove-notes"
                placeholder="Reason for adjustment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button
              onClick={() => handleAdjustment('remove')}
              disabled={isLoading || !quantity}
              variant="destructive"
              className="w-full"
            >
              Remove Stock
            </Button>
          </TabsContent>

          <TabsContent value="set" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="set-quantity">Set Quantity To</Label>
              <Input
                id="set-quantity"
                type="number"
                min="0"
                placeholder="Enter new quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Change: {(Number(quantity) || 0) - product.current_level > 0 ? '+' : ''}{(Number(quantity) || 0) - product.current_level} units
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="set-notes">Notes (optional)</Label>
              <Textarea
                id="set-notes"
                placeholder="Reason for adjustment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button
              onClick={() => handleAdjustment('set')}
              disabled={isLoading || !quantity}
              className="w-full"
            >
              Set Stock Level
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
