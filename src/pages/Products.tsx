import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Image as ImageIcon, Package2, FolderTree, Search, ChevronRight, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { ProductFormDialog } from "@/components/ProductFormDialog";
import { BundleFormDialog } from "@/components/BundleFormDialog";
import { CategoryFormDialog } from "@/components/CategoryFormDialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

const Products = () => {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<any>(null);
  const [bundleDialogOpen, setBundleDialogOpen] = useState(false);
  const [selectedCategoryForEdit, setSelectedCategoryForEdit] = useState<any>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
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
    setProductDialogOpen(true);
  };

  const handleBundleClick = (bundle: any) => {
    setSelectedBundle(bundle);
    setBundleDialogOpen(true);
  };

  const handleCategoryClick = (category: any) => {
    setSelectedCategoryForEdit(category);
    setCategoryDialogOpen(true);
  };

  const handleCreateProduct = () => {
    setSelectedProduct(null);
    setProductDialogOpen(true);
  };

  const handleCreateBundle = () => {
    setSelectedBundle(null);
    setBundleDialogOpen(true);
  };

  const handleCreateCategory = () => {
    setSelectedCategoryForEdit(null);
    setCategoryDialogOpen(true);
  };

  const filteredProducts = products?.filter((product) => {
    const matchesSearch = searchQuery === "" || 
                         product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || 
                           (categoryFilter === "uncategorized" && !product.category_id) ||
                           product.category_id === categoryFilter;
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
          <Button onClick={handleCreateProduct}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
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
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Product Catalog
                  </CardTitle>
                  <Button onClick={handleCreateProduct} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </div>
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
                      <SelectItem value="uncategorized">Uncategorized</SelectItem>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                      <Skeleton key={i} className="h-64 w-full" />
                    ))}
                  </div>
                ) : filteredProducts && filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredProducts.map((product) => (
                      <Card 
                        key={product.id}
                        className="cursor-pointer hover:shadow-lg transition-all"
                        onClick={() => handleProductClick(product)}
                      >
                        <CardContent className="p-0">
                          <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="h-16 w-16 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute top-2 right-2">
                              {product.is_active ? (
                                <Badge className="bg-green-500">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </div>
                          </div>
                          <div className="p-4 space-y-2">
                            <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
                            <h3 className="font-semibold line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {product.categories?.name || "Uncategorized"}
                            </Badge>
                            <div className="flex items-center justify-between pt-2 border-t">
                              <div>
                                <p className="text-xs text-muted-foreground">Unit Price</p>
                                <p className="font-semibold text-lg">${Number(product.unit_price).toFixed(2)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Cost</p>
                                <p className="font-medium">${Number(product.cost_price).toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    {searchQuery || categoryFilter !== "all" ? "No products match your filters" : "No products found"}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bundles Tab */}
          <TabsContent value="bundles">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package2 className="h-5 w-5" />
                    Bundle Catalog
                  </CardTitle>
                  <Button onClick={handleCreateBundle} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Bundle
                  </Button>
                </div>
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
                          <div className="absolute top-2 right-2 z-10">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBundleClick(bundle);
                              }}
                            >
                              Edit
                            </Button>
                          </div>
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FolderTree className="h-5 w-5" />
                      Categories
                    </CardTitle>
                    <Button onClick={handleCreateCategory} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Category
                    </Button>
                  </div>
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
                          className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 relative ${
                            selectedCategory === category.id ? 'bg-muted border-primary' : ''
                          }`}
                        >
                          <div
                            onClick={() => setSelectedCategory(category.id)}
                            className="flex items-center justify-between"
                          >
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
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute top-2 right-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCategoryClick(category);
                            }}
                          >
                            Edit
                          </Button>
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

        <ProductFormDialog
          product={selectedProduct}
          open={productDialogOpen}
          onOpenChange={setProductDialogOpen}
        />

        <BundleFormDialog
          bundle={selectedBundle}
          open={bundleDialogOpen}
          onOpenChange={setBundleDialogOpen}
        />

        <CategoryFormDialog
          category={selectedCategoryForEdit}
          open={categoryDialogOpen}
          onOpenChange={setCategoryDialogOpen}
        />
      </div>
    </DashboardLayout>
  );
};

export default Products;
