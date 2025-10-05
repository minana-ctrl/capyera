import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border-2 px-3 py-1 text-xs font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 backdrop-blur-sm shadow-sm",
        secondary: "border-secondary/30 bg-secondary/10 text-secondary-foreground hover:bg-secondary/20 backdrop-blur-sm",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 backdrop-blur-sm",
        outline: "border-border/50 text-foreground hover:bg-accent/50 backdrop-blur-sm",
        success: "border-success/30 bg-success/10 text-success hover:bg-success/20 backdrop-blur-sm",
        warning: "border-warning/30 bg-warning/10 text-warning hover:bg-warning/20 backdrop-blur-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
