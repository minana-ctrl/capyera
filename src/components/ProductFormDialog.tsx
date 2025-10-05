import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Image as ImageIcon, Upload, Plus, Minus, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const productSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category_id: z.string().optional(),
  unit_price: z.string().min(0, "Unit price must be positive"),
  cost_price: z.string().min(0, "Cost price must be positive"),
  reorder_level: z.string().min(0, "Reorder level must be positive"),
  unit_of_measure: z.string().default("pcs"),
  is_active: z.boolean().default(true),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormDialogProps {
  product?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInventoryUpdate?: () => void;
}

export const ProductFormDialog = ({ product, open, onOpenChange, onInventoryUpdate }: ProductFormDialogProps) => {
  const queryClient = useQueryClient();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image_url || null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<string>("");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stockLevel } = useQuery({
    queryKey: ["warehouse_stock", product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_stock")
        .select("quantity, available_stock, reserved_stock, warehouse_id")
        .eq("product_id", product.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: product?.sku || "",
      name: product?.name || "",
      description: product?.description || "",
      category_id: product?.category_id || "",
      unit_price: product?.unit_price?.toString() || "0",
      cost_price: product?.cost_price?.toString() || "0",
      reorder_level: product?.reorder_level?.toString() || "0",
      unit_of_measure: product?.unit_of_measure || "pcs",
      is_active: product?.is_active ?? true,
    },
  });

  const isActive = watch("is_active");

  useEffect(() => {
    if (product) {
      reset({
        sku: product.sku,
        name: product.name,
        description: product.description || "",
        category_id: product.category_id || "",
        unit_price: product.unit_price?.toString() || "0",
        cost_price: product.cost_price?.toString() || "0",
        reorder_level: product.reorder_level?.toString() || "0",
        unit_of_measure: product.unit_of_measure || "pcs",
        is_active: product.is_active ?? true,
      });
      setImagePreview(product.image_url || null);
    } else {
      reset({
        sku: "",
        name: "",
        description: "",
        category_id: "",
        unit_price: "0",
        cost_price: "0",
        reorder_level: "0",
        unit_of_measure: "pcs",
        is_active: true,
      });
      setImagePreview(null);
    }
  }, [product, reset]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      let imageUrl = product?.image_url;

      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const productData = {
        sku: data.sku,
        name: data.name,
        description: data.description || null,
        category_id: data.category_id || null,
        unit_price: parseFloat(data.unit_price),
        cost_price: parseFloat(data.cost_price),
        reorder_level: parseInt(data.reorder_level),
        unit_of_measure: data.unit_of_measure,
        is_active: data.is_active,
        image_url: imageUrl,
      };

      if (product) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("products")
          .insert([productData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(product ? "Product updated successfully" : "Product created successfully");
      onOpenChange(false);
      setImageFile(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save product");
    },
  });

  const onSubmit = (data: ProductFormData) => {
    mutation.mutate(data);
  };

  const handleAdjustment = async (type: 'add' | 'remove' | 'set') => {
    if (!adjustmentQuantity || isNaN(Number(adjustmentQuantity)) || Number(adjustmentQuantity) < 0) {
      toast.error("Please enter a valid positive number");
      return;
    }

    if (!product?.id || !stockLevel) {
      toast.error("Cannot adjust inventory: product data not available");
      return;
    }

    setIsAdjusting(true);
    try {
      const qty = Number(adjustmentQuantity);
      let newQuantity: number;
      let movementType: string;

      const currentStock = stockLevel.quantity;

      switch (type) {
        case 'add':
          newQuantity = currentStock + qty;
          movementType = 'inbound';
          break;
        case 'remove':
          newQuantity = Math.max(0, currentStock - qty);
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
          updated_at: new Date().toISOString(),
        })
        .eq("product_id", product.id);

      if (updateError) throw updateError;

      // Log stock movement
      const { error: logError } = await supabase
        .from("stock_movements")
        .insert({
          product_id: product.id,
          warehouse_id: stockLevel.warehouse_id,
          movement_type: movementType,
          quantity: type === 'remove' ? -qty : (type === 'add' ? qty : (newQuantity - currentStock)),
          notes: adjustmentNotes || `Manual ${type} adjustment`,
        });

      if (logError) throw logError;

      toast.success("Inventory adjusted successfully");
      
      setAdjustmentQuantity("");
      setAdjustmentNotes("");
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["warehouse_stock"] });
      onInventoryUpdate?.();
    } catch (error: any) {
      console.error("Error adjusting inventory:", error);
      toast.error(error.message || "Failed to adjust inventory");
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Create New Product"}</DialogTitle>
          <DialogDescription>
            {product ? "Update product details or adjust inventory levels" : "Add a new product to your inventory"}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Product Details</TabsTrigger>
            {product && <TabsTrigger value="inventory">Adjust Inventory</TabsTrigger>}
          </TabsList>

          <TabsContent value="details">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex flex-col items-center gap-4">
                  <Avatar className="h-32 w-32 rounded-md">
                    <AvatarImage src={imagePreview || undefined} alt="Product" />
                    <AvatarFallback className="rounded-md bg-muted">
                      <ImageIcon className="h-16 w-16 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <Label htmlFor="image" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted">
                      <Upload className="h-4 w-4" />
                      <span>Upload Image</span>
                    </div>
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </Label>
                </div>

                {product && stockLevel && (
                  <div className="col-span-2 p-4 bg-muted rounded-lg">
                    <h4 className="font-semibold mb-2">Current Stock Levels</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Quantity</p>
                        <p className="text-lg font-bold">{stockLevel.quantity}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Available</p>
                        <p className="text-lg font-bold text-green-600">{stockLevel.available_stock}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Reserved</p>
                        <p className="text-lg font-bold text-orange-600">{stockLevel.reserved_stock}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input id="sku" {...register("sku")} />
                  {errors.sku && <p className="text-sm text-destructive">{errors.sku.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input id="name" {...register("name")} />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" {...register("description")} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category_id">Category</Label>
                  <Select
                    value={watch("category_id") || "none"}
                    onValueChange={(value) => setValue("category_id", value === "none" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit_of_measure">Unit of Measure</Label>
                  <Input id="unit_of_measure" {...register("unit_of_measure")} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit_price">Sales Price *</Label>
                  <Input id="unit_price" type="number" step="0.01" {...register("unit_price")} />
                  {errors.unit_price && <p className="text-sm text-destructive">{errors.unit_price.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost_price">Cost Price *</Label>
                  <Input id="cost_price" type="number" step="0.01" {...register("cost_price")} />
                  {errors.cost_price && <p className="text-sm text-destructive">{errors.cost_price.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reorder_level">Reorder Level *</Label>
                  <Input id="reorder_level" type="number" {...register("reorder_level")} />
                  {errors.reorder_level && <p className="text-sm text-destructive">{errors.reorder_level.message}</p>}
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={isActive}
                    onCheckedChange={(checked) => setValue("is_active", checked)}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : product ? "Update Product" : "Create Product"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {product && (
            <TabsContent value="inventory" className="space-y-4">
              {stockLevel ? (
                <>
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {product.name} (SKU: {product.sku})
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Current stock: <span className="font-semibold">{stockLevel.quantity} units</span>
                    </p>
                  </div>

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
                          value={adjustmentQuantity}
                          onChange={(e) => setAdjustmentQuantity(e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">
                          New total: {stockLevel.quantity + (Number(adjustmentQuantity) || 0)} units
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="add-notes">Notes (optional)</Label>
                        <Textarea
                          id="add-notes"
                          placeholder="Reason for adjustment..."
                          value={adjustmentNotes}
                          onChange={(e) => setAdjustmentNotes(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={() => handleAdjustment('add')}
                        disabled={isAdjusting || !adjustmentQuantity}
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
                          max={stockLevel.quantity}
                          placeholder="Enter quantity"
                          value={adjustmentQuantity}
                          onChange={(e) => setAdjustmentQuantity(e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">
                          New total: {Math.max(0, stockLevel.quantity - (Number(adjustmentQuantity) || 0))} units
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="remove-notes">Notes (optional)</Label>
                        <Textarea
                          id="remove-notes"
                          placeholder="Reason for adjustment..."
                          value={adjustmentNotes}
                          onChange={(e) => setAdjustmentNotes(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={() => handleAdjustment('remove')}
                        disabled={isAdjusting || !adjustmentQuantity}
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
                          value={adjustmentQuantity}
                          onChange={(e) => setAdjustmentQuantity(e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">
                          Change: {(Number(adjustmentQuantity) || 0) - stockLevel.quantity > 0 ? '+' : ''}{(Number(adjustmentQuantity) || 0) - stockLevel.quantity} units
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="set-notes">Notes (optional)</Label>
                        <Textarea
                          id="set-notes"
                          placeholder="Reason for adjustment..."
                          value={adjustmentNotes}
                          onChange={(e) => setAdjustmentNotes(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={() => handleAdjustment('set')}
                        disabled={isAdjusting || !adjustmentQuantity}
                        className="w-full"
                      >
                        Set Stock Level
                      </Button>
                    </TabsContent>
                  </Tabs>
                </>
              ) : (
                <div className="p-8 text-center space-y-4">
                  <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">No Warehouse Stock</h4>
                    <p className="text-sm text-muted-foreground">
                      This product hasn't been assigned to a warehouse yet. Go to the Inventory page to add stock.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
