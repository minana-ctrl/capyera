import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, TrendingUp, Package, AlertTriangle, Layers, Clock } from "lucide-react";

export default function HowItWorks() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">How It Works</h1>
          <p className="text-muted-foreground mt-2">
            Understanding the key calculations and metrics in your inventory system
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-primary" />
                <CardTitle>Par Level</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Par Level is the ideal stock quantity you should maintain for each product to meet demand without overstocking.
              </p>
              <div className="bg-muted p-3 rounded-md">
                <p className="font-mono text-sm">Par Level = Target Inventory Quantity</p>
              </div>
              <div className="space-y-2 text-sm">
                <p><strong>Health Status:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Current ≤ Par Level × 0.5 = <span className="text-destructive font-semibold">Critical</span></li>
                  <li>Current ≤ Par Level = <span className="text-orange-500 font-semibold">Warning</span></li>
                  <li>Current &gt; Par Level = <span className="text-green-500 font-semibold">Healthy</span></li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle>Velocity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Velocity measures how quickly your inventory is sold or consumed over time.
              </p>
              <div className="bg-muted p-3 rounded-md">
                <p className="font-mono text-sm">Velocity = Units Sold ÷ Days</p>
              </div>
              <div className="space-y-2 text-sm">
                <p><strong>Time Periods:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>7d Velocity:</strong> Short-term trends</li>
                  <li><strong>14d Velocity:</strong> Medium-term average</li>
                  <li><strong>30d Velocity:</strong> Long-term baseline</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle>Stock Runway</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Stock Runway shows how many days your current inventory will last based on velocity.
              </p>
              <div className="bg-muted p-3 rounded-md">
                <p className="font-mono text-sm">Runway = Available Stock ÷ Velocity</p>
              </div>
              <div className="space-y-2 text-sm">
                <p><strong>Status Indicators:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Runway ≤ 7 days = <span className="text-destructive font-semibold">Critical</span></li>
                  <li>Runway ≤ 14 days = <span className="text-orange-500 font-semibold">Warning</span></li>
                  <li>Runway &gt; 14 days = <span className="text-green-500 font-semibold">Healthy</span></li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-primary" />
                <CardTitle>Available vs Reserved Stock</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Understanding the difference between total, available, and reserved inventory.
              </p>
              <div className="bg-muted p-3 rounded-md space-y-1">
                <p className="font-mono text-sm">Total Stock = Physical Quantity</p>
                <p className="font-mono text-sm">Reserved = Allocated to Orders</p>
                <p className="font-mono text-sm">Available = Total - Reserved</p>
              </div>
              <p className="text-sm text-muted-foreground">
                <strong>Available Stock</strong> is what you can actually sell or allocate to new orders.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-primary" />
                <CardTitle>Bundle Cost</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Bundle cost is automatically calculated from component products.
              </p>
              <div className="bg-muted p-3 rounded-md">
                <p className="font-mono text-sm">Bundle Cost = Σ (Component Cost × Quantity)</p>
              </div>
              <div className="space-y-2 text-sm">
                <p><strong>Example:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Product A: $10 × 2 units = $20</li>
                  <li>Product B: $5 × 3 units = $15</li>
                  <li><strong>Total Bundle Cost = $35</strong></li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Calculator className="h-5 w-5 text-primary" />
                <CardTitle>Inventory Health %</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Overall inventory health based on products meeting par levels.
              </p>
              <div className="bg-muted p-3 rounded-md">
                <p className="font-mono text-sm">Health % = (Healthy Products ÷ Total Products) × 100</p>
              </div>
              <div className="space-y-2 text-sm">
                <p><strong>Calculation:</strong></p>
                <p className="text-muted-foreground">
                  Products with current stock above par level are considered "healthy". 
                  The percentage shows the overall system health.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
