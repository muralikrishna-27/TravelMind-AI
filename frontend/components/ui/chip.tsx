import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex min-h-[38px] items-center justify-center gap-2 whitespace-nowrap rounded-[var(--r-pill)] border px-4 py-1.5 text-sm font-medium transition-colors duration-[var(--dur-1)] ease-[var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)] select-none",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:border-[var(--border-strong)] hover:text-[var(--text)]",
        selected:
          "border-transparent bg-[var(--primary-bg)] text-[var(--primary-fg)]",
        live: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface ChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof chipVariants> {
  selected?: boolean;
  liveDot?: boolean;
  asSpan?: boolean;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  (
    {
      className,
      variant,
      selected = false,
      liveDot = false,
      asSpan = false,
      children,
      ...props
    },
    ref
  ) => {
    const resolvedVariant = selected
      ? "selected"
      : liveDot
        ? "live"
        : variant || "default";

    if (asSpan) {
      return (
        <span
          className={cn(
            chipVariants({ variant: resolvedVariant }),
            "min-h-[32px] px-3.5 py-1 text-xs",
            className
          )}
        >
          {liveDot && (
            <span
              className="h-2 w-2 shrink-0 rounded-[var(--r-pill)] bg-[var(--live)]"
              aria-hidden="true"
            />
          )}
          <span>{children}</span>
        </span>
      );
    }

    return (
      <button
        type="button"
        ref={ref}
        aria-pressed={selected}
        className={cn(
          chipVariants({ variant: resolvedVariant }),
          "cursor-pointer",
          className
        )}
        {...props}
      >
        {liveDot && (
          <span
            className="h-2 w-2 shrink-0 rounded-[var(--r-pill)] bg-[var(--live)]"
            aria-hidden="true"
          />
        )}
        <span>{children}</span>
      </button>
    );
  }
);
Chip.displayName = "Chip";

export { chipVariants };
