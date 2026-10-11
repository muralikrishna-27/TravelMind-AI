import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hideLabel?: boolean;
  error?: string;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      label,
      hideLabel = false,
      error,
      helperText,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="flex w-full min-w-0 flex-col gap-2">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "text-xs font-medium uppercase tracking-[0.06em] text-[var(--muted)]",
              hideLabel && "sr-only"
            )}
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={cn(
            "flex min-h-[44px] w-full min-w-0 rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[15px] text-[var(--text)] placeholder:text-[var(--muted)] outline-none transition-colors duration-[var(--dur-1)] ease-[var(--ease)] focus:border-[var(--border-strong)] focus:outline-none focus-visible:border-[var(--border-strong)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            error &&
              "border-[var(--danger-fg)] focus:border-[var(--danger-fg)] focus-visible:border-[var(--danger-fg)]",
            className
          )}
          {...props}
        />
        {helperText && !error && (
          <p id={helperId} className="text-xs text-[var(--muted)]">
            {helperText}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-xs font-medium text-[var(--danger-fg)]"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
