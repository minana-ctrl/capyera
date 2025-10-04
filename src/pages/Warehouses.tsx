import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Warehouse, MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { WarehouseFormDialog } from "@/components/WarehouseFormDialog";
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

const Warehouses = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  const [deleteWarehouse, setDeleteWarehouse] = useState<any>(null);

  const { data: warehouses, isLoading, refetch } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const handleEdit = (warehouse: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedWarehouse(warehouse);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteWarehouse) return;
    
    try {
      const { error } = await supabase
        .from("warehouses")
        .delete()
        .eq("id", deleteWarehouse.id);

      if (error) throw error;
      toast.success("Warehouse deleted successfully");
      refetch();
    } catch (error: any) {
      console.error("Error deleting warehouse:", error);
      toast.error(error.message || "Failed to delete warehouse");
    } finally {
      setDeleteWarehouse(null);
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setSelectedWarehouse(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Warehouses</h2>
            <p className="text-muted-foreground">Manage storage locations and facilities</p>
          </div>
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Warehouse
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {warehouses?.map((warehouse) => (
              <Card key={warehouse.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Warehouse className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{warehouse.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleEdit(warehouse, e)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteWarehouse(warehouse);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {warehouse.location && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-muted-foreground">{warehouse.location}</span>
                    </div>
                  )}

                  {warehouse.capacity && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Capacity</span>
                      <span className="font-semibold">{warehouse.capacity.toLocaleString()} units</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium">
                      {new Date(warehouse.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && warehouses?.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Warehouse className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No warehouses found</p>
            </CardContent>
          </Card>
        )}
      </div>

      <WarehouseFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        warehouse={selectedWarehouse}
        onSuccess={() => refetch()}
      />

      <AlertDialog open={!!deleteWarehouse} onOpenChange={() => setDeleteWarehouse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Warehouse</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteWarehouse?.name}"? This action cannot be undone.
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

export default Warehouses;
