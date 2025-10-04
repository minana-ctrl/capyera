import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const warehouseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  location: z.string().trim().max(255, "Location must be less than 255 characters").optional(),
  capacity: z.coerce.number().int().min(0, "Capacity must be positive").optional().nullable(),
});

type WarehouseFormData = z.infer<typeof warehouseSchema>;

interface WarehouseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: any;
  onSuccess: () => void;
}

export const WarehouseFormDialog = ({
  open,
  onOpenChange,
  warehouse,
  onSuccess,
}: WarehouseFormDialogProps) => {
  const isEditing = !!warehouse;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<WarehouseFormData>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: warehouse || {},
  });

  const onSubmit = async (data: WarehouseFormData) => {
    try {
      if (isEditing) {
        const { error } = await supabase
          .from("warehouses")
          .update({
            name: data.name,
            location: data.location || null,
            capacity: data.capacity || null,
          })
          .eq("id", warehouse.id);

        if (error) throw error;
        toast.success("Warehouse updated successfully");
      } else {
        const { error } = await supabase
          .from("warehouses")
          .insert({
            name: data.name,
            location: data.location || null,
            capacity: data.capacity || null,
          });

        if (error) throw error;
        toast.success("Warehouse created successfully");
      }

      onSuccess();
      onOpenChange(false);
      reset();
    } catch (error: any) {
      console.error("Error saving warehouse:", error);
      toast.error(error.message || "Failed to save warehouse");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Warehouse" : "Add New Warehouse"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Warehouse Name *</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Main Distribution Center"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              {...register("location")}
              placeholder="123 Industrial Blvd, City, State, ZIP"
            />
            {errors.location && (
              <p className="text-sm text-destructive">{errors.location.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity (units)</Label>
            <Input
              id="capacity"
              type="number"
              {...register("capacity")}
              placeholder="10000"
            />
            {errors.capacity && (
              <p className="text-sm text-destructive">{errors.capacity.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
