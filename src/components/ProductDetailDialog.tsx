import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon } from "lucide-react";

interface ProductDetailDialogProps {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProductDetailDialog = ({ product, open, onOpenChange }: ProductDetailDialogProps) => {
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Product Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="flex gap-6">
            <Avatar className="h-32 w-32 rounded-md">
              <AvatarImage src={product.image_url || undefined} alt={product.name} />
              <AvatarFallback className="rounded-md bg-muted">
                <ImageIcon className="h-16 w-16 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-2xl font-bold">{product.name}</h3>
                <p className="font-mono text-sm text-muted-foreground">{product.sku}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">
                  {product.categories?.name || "Uncategorized"}
                </Badge>
                {product.is_active ? (
                  <Badge className="bg-green-500">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Unit Price</p>
              <p className="text-2xl font-bold">${Number(product.unit_price).toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Cost Price</p>
              <p className="text-2xl font-bold">${Number(product.cost_price).toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Reorder Level</p>
              <p className="text-xl font-semibold">{product.reorder_level || 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Unit of Measure</p>
              <p className="text-xl font-semibold">{product.unit_of_measure || "pcs"}</p>
            </div>
          </div>

          {product.description && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="text-sm">{product.description}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">7-Day Velocity</p>
              <p className="font-semibold">{Number(product.velocity_7d || 0).toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">14-Day Velocity</p>
              <p className="font-semibold">{Number(product.velocity_14d || 0).toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">30-Day Velocity</p>
              <p className="font-semibold">{Number(product.velocity_30d || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
