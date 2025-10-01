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
              name,
              cost_price
            )
          )
        `)
        .order("name");
      
      if (error) throw error;
      
      // Calculate "Can Make" and Bundle Cost for each bundle
      const bundlesWithCalcs = await Promise.all(data.map(async (bundle) => {
        // Calculate can make quantity
        const { data: canMakeData } = await supabase
          .rpc('calculate_bundle_availability', { bundle_uuid: bundle.id });
        
        // Calculate bundle cost
        const bundleCost = bundle.bundle_components?.reduce((sum: number, comp: any) => {
          return sum + (Number(comp.products?.cost_price || 0) * comp.quantity);
        }, 0) || 0;
        
        return {
          ...bundle,
          canMake: canMakeData || 0,
          bundleCost: bundleCost
        };
      }));
      
      return bundlesWithCalcs;
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
                {bundles?.map((bundle: any) => (
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
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Can Make</p>
                              <p className="text-lg font-bold text-primary">{bundle.canMake}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Bundle Cost</p>
                              <p className="text-lg font-semibold">${bundle.bundleCost.toFixed(2)}</p>
                            </div>
                            <Badge variant="outline">
                              {bundle.bundle_components?.length || 0} components
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
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium">Bundle Components:</p>
                            <p className="text-xs text-muted-foreground">
                              Bundle Cost: ${bundle.bundleCost.toFixed(2)} (auto-calculated)
                            </p>
                          </div>
                          <div className="space-y-2">
                            {bundle.bundle_components?.map((component: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="font-mono">
                                    {component.products?.sku}
                                  </Badge>
                                  <span>{component.products?.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-muted-foreground">
                                    Qty: {component.quantity}
                                  </span>
                                  <span className="text-muted-foreground">
                                    Cost: ${(Number(component.products?.cost_price || 0) * component.quantity).toFixed(2)}
                                  </span>
                                </div>
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
