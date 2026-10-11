import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-[var(--r-lg)] border bg-[var(--surface)] text-[var(--text)] transition-colors duration-[var(--dur-1)] ease-[var(--ease)]",
  {
    variants: {
      variant: {
        default: "border-[var(--border)]",
        dashed: "border-dashed border-[var(--border-strong)] bg-transparent",
        interactive:
          "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]/50 cursor-pointer",
        active: "border-[var(--live)] bg-[var(--surface)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

export { Card, cardVariants };
