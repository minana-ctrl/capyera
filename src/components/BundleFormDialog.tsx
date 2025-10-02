import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
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
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

const bundleSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category_id: z.string().optional(),
  is_active: z.boolean().default(true),
});

type BundleFormData = z.infer<typeof bundleSchema>;

interface BundleComponent {
  product_id: string;
  quantity: number;
  product?: any;
}

interface BundleFormDialogProps {
  bundle?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BundleFormDialog = ({ bundle, open, onOpenChange }: BundleFormDialogProps) => {
  const queryClient = useQueryClient();
  const [components, setComponents] = useState<BundleComponent[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [componentQuantity, setComponentQuantity] = useState<string>("1");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
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
  } = useForm<BundleFormData>({
    resolver: zodResolver(bundleSchema),
    defaultValues: {
      sku: bundle?.sku || "",
      name: bundle?.name || "",
      description: bundle?.description || "",
      category_id: bundle?.category_id || "",
      is_active: bundle?.is_active ?? true,
    },
  });

  const isActive = watch("is_active");

  useEffect(() => {
    if (bundle) {
      reset({
        sku: bundle.sku,
        name: bundle.name,
        description: bundle.description || "",
        category_id: bundle.category_id || "",
        is_active: bundle.is_active ?? true,
      });
      
      if (bundle.bundle_components) {
        setComponents(
          bundle.bundle_components.map((comp: any) => ({
            product_id: comp.products?.id || comp.product_id,
            quantity: comp.quantity,
            product: comp.products,
          }))
        );
      }
    } else {
      reset({
        sku: "",
        name: "",
        description: "",
        category_id: "",
        is_active: true,
      });
      setComponents([]);
    }
  }, [bundle, reset]);

  const addComponent = () => {
    if (!selectedProductId) {
      toast.error("Please select a product");
      return;
    }
    
    const qty = parseInt(componentQuantity);
    if (qty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    const product = products?.find((p) => p.id === selectedProductId);
    if (components.some((c) => c.product_id === selectedProductId)) {
      toast.error("Product already added");
      return;
    }

    setComponents([...components, { product_id: selectedProductId, quantity: qty, product }]);
    setSelectedProductId("");
    setComponentQuantity("1");
  };

  const removeComponent = (productId: string) => {
    setComponents(components.filter((c) => c.product_id !== productId));
  };

  const totalCost = components.reduce((sum, comp) => {
    return sum + (Number(comp.product?.cost_price || 0) * comp.quantity);
  }, 0);

  const mutation = useMutation({
    mutationFn: async (data: BundleFormData) => {
      if (components.length === 0) {
        throw new Error("Bundle must have at least one component");
      }

      const bundleData = {
        sku: data.sku,
        name: data.name,
        description: data.description || null,
        category_id: data.category_id || null,
        is_active: data.is_active,
      };

      let bundleId: string;

      if (bundle) {
        const { error } = await supabase
          .from("bundles")
          .update(bundleData)
          .eq("id", bundle.id);
        if (error) throw error;
        bundleId = bundle.id;

        // Delete existing components
        await supabase
          .from("bundle_components")
          .delete()
          .eq("bundle_id", bundleId);
      } else {
        const { data: newBundle, error } = await supabase
          .from("bundles")
          .insert([bundleData])
          .select()
          .single();
        if (error) throw error;
        bundleId = newBundle.id;
      }

      // Insert components
      const { error: componentsError } = await supabase
        .from("bundle_components")
        .insert(
          components.map((comp) => ({
            bundle_id: bundleId,
            product_id: comp.product_id,
            quantity: comp.quantity,
          }))
        );
      if (componentsError) throw componentsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      toast.success(bundle ? "Bundle updated successfully" : "Bundle created successfully");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save bundle");
    },
  });

  const onSubmit = (data: BundleFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bundle ? "Edit Bundle" : "Create New Bundle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input id="sku" {...register("sku")} />
              {errors.sku && <p className="text-sm text-destructive">{errors.sku.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Bundle Name *</Label>
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

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={isActive}
                onCheckedChange={(checked) => setValue("is_active", checked)}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <h4 className="font-semibold">Bundle Components</h4>
            
            <div className="flex gap-2">
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Qty"
                value={componentQuantity}
                onChange={(e) => setComponentQuantity(e.target.value)}
                className="w-24"
              />
              <Button type="button" onClick={addComponent} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {components.length > 0 && (
              <div className="space-y-2">
                {components.map((comp) => (
                  <div key={comp.product_id} className="flex items-center justify-between p-3 bg-muted rounded">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">
                        {comp.product?.sku}
                      </Badge>
                      <span>{comp.product?.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">Qty: {comp.quantity}</span>
                      <span className="text-muted-foreground">
                        ${(Number(comp.product?.cost_price || 0) * comp.quantity).toFixed(2)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeComponent(comp.product_id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded font-semibold">
                  <span>Total Bundle Cost (auto-calculated)</span>
                  <span>${totalCost.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || components.length === 0}>
              {mutation.isPending ? "Saving..." : bundle ? "Update Bundle" : "Create Bundle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
