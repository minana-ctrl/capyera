import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Image as ImageIcon, Package2, FolderTree, Search, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { ProductDetailDialog } from "@/components/ProductDetailDialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const Products = () => {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          categories (
            name
          )
        `)
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: bundles, isLoading: bundlesLoading } = useQuery({
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
        const { data: canMakeData } = await supabase
          .rpc('calculate_bundle_availability', { bundle_uuid: bundle.id });
        
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

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setDialogOpen(true);
  };

  const filteredProducts = products?.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categoryProducts = selectedCategory
    ? products?.filter((p) => p.category_id === selectedCategory)
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Products</h2>
            <p className="text-muted-foreground">Manage your product catalog</p>
          </div>
        </div>

        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              Individual Products
            </TabsTrigger>
            <TabsTrigger value="bundles">
              <Package2 className="h-4 w-4 mr-2" />
              Bundles
            </TabsTrigger>
            <TabsTrigger value="categories">
              <FolderTree className="h-4 w-4 mr-2" />
              Categories
            </TabsTrigger>
          </TabsList>

          {/* Individual Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Product Catalog
                </CardTitle>
                <div className="flex gap-3 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or SKU..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">Image</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Cost Price</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts?.map((product) => (
                          <TableRow 
                            key={product.id} 
                            className="hover:bg-muted/50 cursor-pointer"
                            onClick={() => handleProductClick(product)}
                          >
                            <TableCell>
                              <Avatar className="h-12 w-12 rounded-md">
                                <AvatarImage src={product.image_url || undefined} alt={product.name} />
                                <AvatarFallback className="rounded-md bg-muted">
                                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                </AvatarFallback>
                              </Avatar>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                            <TableCell className="font-medium">
                              {product.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {product.categories?.name || "Uncategorized"}
                              </Badge>
                            </TableCell>
                            <TableCell>${Number(product.unit_price).toFixed(2)}</TableCell>
                            <TableCell>${Number(product.cost_price).toFixed(2)}</TableCell>
                            <TableCell>
                              {product.is_active ? (
                                <Badge className="bg-green-500">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {!productsLoading && filteredProducts?.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No products found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bundles Tab */}
          <TabsContent value="bundles">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package2 className="h-5 w-5" />
                  Bundle Catalog
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bundlesLoading ? (
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
                {!bundlesLoading && bundles?.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No bundles found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderTree className="h-5 w-5" />
                    Categories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {categoriesLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {categories?.map((category) => (
                        <div
                          key={category.id}
                          onClick={() => setSelectedCategory(category.id)}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedCategory === category.id ? 'bg-muted border-primary' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{category.name}</h4>
                              {category.description && (
                                <p className="text-sm text-muted-foreground">{category.description}</p>
                              )}
                            </div>
                            <Badge variant="outline">
                              {products?.filter((p) => p.category_id === category.id).length || 0} products
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!categoriesLoading && categories?.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No categories found
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedCategory 
                      ? `Products in ${categories?.find((c) => c.id === selectedCategory)?.name}`
                      : 'Select a category'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedCategory ? (
                    categoryProducts.length > 0 ? (
                      <div className="space-y-2">
                        {categoryProducts.map((product) => (
                          <div
                            key={product.id}
                            onClick={() => handleProductClick(product)}
                            className="p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 flex items-center gap-3"
                          >
                            <Avatar className="h-12 w-12 rounded-md">
                              <AvatarImage src={product.image_url || undefined} alt={product.name} />
                              <AvatarFallback className="rounded-md bg-muted">
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-medium">{product.name}</p>
                              <p className="text-sm text-muted-foreground font-mono">{product.sku}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">${Number(product.unit_price).toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No products in this category
                      </div>
                    )
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Click on a category to view its products
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <ProductDetailDialog
          product={selectedProduct}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </div>
    </DashboardLayout>
  );
};

export default Products;
