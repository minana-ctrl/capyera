import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  category?: string;
  className?: string;
}

const categoryColors: Record<string, string> = {
  default: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
};

export const CategoryBadge = ({ category, className }: CategoryBadgeProps) => {
  if (!category) {
    return (
      <Badge variant="outline" className={className}>
        Uncategorized
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn(categoryColors.default, className)}
    >
      {category}
    </Badge>
  );
};
