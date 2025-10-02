import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  variant?: "default" | "warning" | "critical";
}

export const StatsCard = ({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
}: StatsCardProps) => {
  const getVariantStyles = () => {
    switch (variant) {
      case "critical":
        return {
          card: "border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background",
          icon: "text-red-500 bg-red-100 dark:bg-red-950/30",
          value: "text-red-600 dark:text-red-400",
          shadow: "hover:shadow-[0_8px_30px_rgb(239,68,68,0.12)] dark:hover:shadow-[0_8px_30px_rgb(239,68,68,0.2)]"
        };
      case "warning":
        return {
          card: "border-orange-200 dark:border-orange-900/50 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-background",
          icon: "text-orange-500 bg-orange-100 dark:bg-orange-950/30",
          value: "text-orange-600 dark:text-orange-400",
          shadow: "hover:shadow-[0_8px_30px_rgb(249,115,22,0.12)] dark:hover:shadow-[0_8px_30px_rgb(249,115,22,0.2)]"
        };
      default:
        return {
          card: "border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background",
          icon: "text-blue-500 bg-blue-100 dark:bg-blue-950/30",
          value: "text-foreground",
          shadow: "hover:shadow-[0_8px_30px_rgb(59,130,246,0.12)] dark:hover:shadow-[0_8px_30px_rgb(59,130,246,0.2)]"
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Card className={cn(
      "transition-all duration-300",
      styles.card,
      styles.shadow,
      "hover:scale-[1.02]"
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110", styles.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-bold tracking-tight", styles.value)}>
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">{description}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <div className={cn(
              "flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
              trend.positive 
                ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" 
                : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
            )}>
              {trend.positive ? "↑" : "↓"} {trend.value}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
