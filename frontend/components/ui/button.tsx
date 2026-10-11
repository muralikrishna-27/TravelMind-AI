import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--r-pill)] text-[15px] font-medium transition-colors duration-[var(--dur-1)] ease-[var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-[0.5px] cursor-pointer select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--primary-bg)] text-[var(--primary-fg)] hover:opacity-90",
        ghost:
          "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]",
        subtle:
          "bg-transparent text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
        danger:
          "border border-[var(--danger-fg)]/30 bg-[var(--danger-bg)] text-[var(--danger-fg)] hover:opacity-90",
        icon: "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]",
      },
      size: {
        sm: "min-h-[38px] px-4 py-1.5 text-sm",
        md: "min-h-[44px] px-5 py-2.5 text-[15px]",
        lg: "min-h-[48px] px-6 py-3 text-base",
        icon: "h-[44px] w-[44px] p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = Boolean(disabled || loading);

    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <Loader2
            className="h-4 w-4 shrink-0 motion-safe:animate-spin"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
        <span>{loading && loadingText ? loadingText : children}</span>
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
