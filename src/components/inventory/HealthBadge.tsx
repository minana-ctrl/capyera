import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface HealthBadgeProps {
  currentLevel: number;
  parLevel: number;
  velocity: number;
}

export const HealthBadge = ({
  currentLevel,
  parLevel,
  velocity,
}: HealthBadgeProps) => {
  // Calculate days remaining based on velocity
  const daysRemaining = velocity > 0 ? Math.floor(currentLevel / velocity) : 999;

  let status: "healthy" | "warning" | "critical";
  let label: string;
  let colorClass: string;

  if (currentLevel === 0) {
    status = "critical";
    label = "Out of Stock";
    colorClass = "bg-destructive text-destructive-foreground";
  } else if (daysRemaining <= 7) {
    status = "critical";
    label = `${daysRemaining}d remaining`;
    colorClass = "bg-destructive text-destructive-foreground";
  } else if (currentLevel <= parLevel * 0.5 || daysRemaining <= 14) {
    status = "warning";
    label = daysRemaining <= 14 ? `${daysRemaining}d remaining` : "Low Stock";
    colorClass = "bg-orange-500 text-white";
  } else if (currentLevel <= parLevel) {
    status = "warning";
    label = "Below Par";
    colorClass = "bg-yellow-500 text-black";
  } else {
    status = "healthy";
    label = "Healthy";
    colorClass = "bg-green-500 text-white";
  }

  return (
    <Badge className={cn(colorClass, "whitespace-nowrap")}>
      {label}
    </Badge>
  );
};
