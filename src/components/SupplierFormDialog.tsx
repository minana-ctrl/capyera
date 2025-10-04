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

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  contact_person: z.string().trim().max(100, "Contact person must be less than 100 characters").optional(),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters").optional().or(z.literal("")),
  phone: z.string().trim().max(20, "Phone must be less than 20 characters").optional(),
  address: z.string().trim().max(500, "Address must be less than 500 characters").optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: any;
  onSuccess: () => void;
}

export const SupplierFormDialog = ({
  open,
  onOpenChange,
  supplier,
  onSuccess,
}: SupplierFormDialogProps) => {
  const isEditing = !!supplier;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: supplier || {},
  });

  const onSubmit = async (data: SupplierFormData) => {
    try {
      if (isEditing) {
        const { error } = await supabase
          .from("suppliers")
          .update({
            name: data.name,
            contact_person: data.contact_person || null,
            email: data.email || null,
            phone: data.phone || null,
            address: data.address || null,
          })
          .eq("id", supplier.id);

        if (error) throw error;
        toast.success("Supplier updated successfully");
      } else {
        const { error } = await supabase
          .from("suppliers")
          .insert({
            name: data.name,
            contact_person: data.contact_person || null,
            email: data.email || null,
            phone: data.phone || null,
            address: data.address || null,
          });

        if (error) throw error;
        toast.success("Supplier created successfully");
      }

      onSuccess();
      onOpenChange(false);
      reset();
    } catch (error: any) {
      console.error("Error saving supplier:", error);
      toast.error(error.message || "Failed to save supplier");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Supplier Name *</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Acme Corp"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_person">Contact Person</Label>
            <Input
              id="contact_person"
              {...register("contact_person")}
              placeholder="John Smith"
            />
            {errors.contact_person && (
              <p className="text-sm text-destructive">{errors.contact_person.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="contact@supplier.com"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder="+1 (555) 123-4567"
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              {...register("address")}
              placeholder="456 Supplier St, City, State, ZIP"
              rows={3}
            />
            {errors.address && (
              <p className="text-sm text-destructive">{errors.address.message}</p>
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
