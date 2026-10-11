import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-2 rounded-[var(--r-pill)] border px-3.5 py-1 text-xs font-medium leading-tight",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)]",
        live: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)]",
        warn: "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn-fg)]",
        success:
          "border-[var(--live)]/30 bg-[var(--live-soft)] text-[var(--live)]",
        danger:
          "border-[var(--danger-fg)]/30 bg-[var(--danger-bg)] text-[var(--danger-fg)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({
  className,
  variant = "default",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const showDot = dot || variant === "live";

  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {showDot && (
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-[var(--r-pill)]",
            variant === "warn"
              ? "bg-[var(--warn-fg)]"
              : variant === "danger"
                ? "bg-[var(--danger-fg)]"
                : "bg-[var(--live)]"
          )}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
}

export { badgeVariants };
