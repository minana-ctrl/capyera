import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TimelineProductCardProps {
  sku: string;
  name: string;
  available: number;
  velocity: number;
  runway: number;
  stockoutDate: Date;
  status: "critical" | "warning" | "healthy";
  parLevel: number;
}

export const TimelineProductCard = ({
  sku,
  name,
  available,
  velocity,
  runway,
  stockoutDate,
  status,
  parLevel,
}: TimelineProductCardProps) => {
  const getStatusColor = () => {
    if (status === "critical") return "text-destructive";
    if (status === "warning") return "text-orange-500";
    return "text-green-500";
  };

  const getProgressColor = () => {
    if (runway <= 7) return "bg-destructive";
    if (runway <= 14) return "bg-orange-500";
    if (runway <= 30) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getTrendIcon = () => {
    if (velocity > 2) return <TrendingUp className="h-3 w-3" />;
    if (velocity < 0.5) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const maxRunway = 60;
  const progressValue = Math.min((runway / maxRunway) * 100, 100);

  return (
    <Card className="hover:shadow-md transition-all">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold truncate">{name}</h4>
              <p className="text-sm text-muted-foreground font-mono">{sku}</p>
            </div>
            <Badge
              variant={status === "critical" ? "destructive" : "secondary"}
              className={cn(
                status === "warning" && "bg-orange-500 text-white hover:bg-orange-500/80"
              )}
            >
              {status === "critical" ? "Critical" : status === "warning" ? "Warning" : "Healthy"}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Available</p>
              <p className="font-semibold">{available}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Par Level</p>
              <p className="font-semibold">{parLevel}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                Velocity {getTrendIcon()}
              </p>
              <p className="font-semibold">{velocity.toFixed(2)}/day</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Stock Runway</span>
              <span className={cn("font-bold", getStatusColor())}>
                {runway} days
              </span>
            </div>
            <Progress value={progressValue} className="h-2">
              <div className={cn("h-full rounded-full transition-all", getProgressColor())} style={{ width: `${progressValue}%` }} />
            </Progress>
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">Projected Stockout</p>
            <p className="text-sm font-semibold">
              {format(stockoutDate, "MMM dd, yyyy")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
