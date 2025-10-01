import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package2, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const Bundles = () => {
  const { data: bundles, isLoading } = useQuery({
    queryKey: ["bundles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bundles")
        .select(`
          *,
          categories (
            name
          ),
          bundle_components (
            quantity,
            products (
              sku,
              name
            )
          )
        `)
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Bundles</h2>
            <p className="text-muted-foreground">Product bundle configurations</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package2 className="h-5 w-5" />
              Bundle Catalog
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {bundles?.map((bundle) => (
                  <Collapsible key={bundle.id}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-4">
                            <ChevronRight className="h-5 w-5 transition-transform ui-expanded:rotate-90" />
                            <div className="text-left">
                              <p className="font-mono text-sm text-muted-foreground">{bundle.sku}</p>
                              <p className="font-semibold">{bundle.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {bundle.bundle_components?.length || 0} items
                            </Badge>
                            {bundle.is_active ? (
                              <Badge className="bg-green-500">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t px-4 pb-4 pt-2">
                          <p className="text-sm font-medium mb-2">Bundle Components:</p>
                          <div className="space-y-1">
                            {bundle.bundle_components?.map((component, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm pl-4">
                                <Badge variant="secondary" className="font-mono">
                                  {component.products?.sku}
                                </Badge>
                                <span>{component.products?.name}</span>
                                <span className="text-muted-foreground">× {component.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
            {!isLoading && bundles?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No bundles found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Bundles;
