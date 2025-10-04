import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Mail, Phone, MapPin, User, Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { SupplierFormDialog } from "@/components/SupplierFormDialog";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Suppliers = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<any>(null);

  const { data: suppliers, isLoading, refetch } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const handleEdit = (supplier: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSupplier(supplier);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteSupplier) return;
    
    try {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", deleteSupplier.id);

      if (error) throw error;
      toast.success("Supplier deleted successfully");
      refetch();
    } catch (error: any) {
      console.error("Error deleting supplier:", error);
      toast.error(error.message || "Failed to delete supplier");
    } finally {
      setDeleteSupplier(null);
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setSelectedSupplier(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Suppliers</h2>
            <p className="text-muted-foreground">Manage vendor relationships and contacts</p>
          </div>
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Supplier
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Supplier Directory
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {suppliers?.map((supplier) => (
                  <Card key={supplier.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          {supplier.name}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleEdit(supplier, e)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteSupplier(supplier);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {supplier.contact_person && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{supplier.contact_person}</span>
                        </div>
                      )}

                      {supplier.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a
                            href={`mailto:${supplier.email}`}
                            className="text-primary hover:underline"
                          >
                            {supplier.email}
                          </a>
                        </div>
                      )}

                      {supplier.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a
                            href={`tel:${supplier.phone}`}
                            className="text-primary hover:underline"
                          >
                            {supplier.phone}
                          </a>
                        </div>
                      )}

                      {supplier.address && (
                        <div className="flex items-start gap-2 text-sm pt-2 border-t">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <span className="text-muted-foreground">{supplier.address}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span>Added {new Date(supplier.created_at).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {!isLoading && suppliers?.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No suppliers found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SupplierFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        supplier={selectedSupplier}
        onSuccess={() => refetch()}
      />

      <AlertDialog open={!!deleteSupplier} onOpenChange={() => setDeleteSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteSupplier?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Suppliers;
