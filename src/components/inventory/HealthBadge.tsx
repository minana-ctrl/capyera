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
    colorClass = "bg-gradient-to-r from-red-500 to-red-600 text-white border-0 shadow-sm";
  } else if (daysRemaining <= 7) {
    status = "critical";
    label = `⚠️ ${daysRemaining}d left`;
    colorClass = "bg-gradient-to-r from-red-500 to-red-600 text-white border-0 shadow-sm";
  } else if (currentLevel <= parLevel * 0.5 || daysRemaining <= 14) {
    status = "warning";
    label = daysRemaining <= 14 ? `⏰ ${daysRemaining}d left` : "⚠️ Low Stock";
    colorClass = "bg-gradient-to-r from-orange-500 to-orange-600 text-white border-0 shadow-sm";
  } else if (currentLevel <= parLevel) {
    status = "warning";
    label = "📊 Below Par";
    colorClass = "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border-0 shadow-sm";
  } else {
    status = "healthy";
    label = "✓ Healthy";
    colorClass = "bg-gradient-to-r from-green-500 to-green-600 text-white border-0 shadow-sm";
  }

  return (
    <Badge className={cn(colorClass, "whitespace-nowrap font-semibold px-3 py-1")}>
      {label}
    </Badge>
  );
};
