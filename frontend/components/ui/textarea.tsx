import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hideLabel?: boolean;
  error?: string;
  helperText?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
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
    const textareaId = id || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    return (
      <div className="flex w-full min-w-0 flex-col gap-2">
        {label && (
          <label
            htmlFor={textareaId}
            className={cn(
              "text-xs font-medium uppercase tracking-[0.06em] text-[var(--muted)]",
              hideLabel && "sr-only"
            )}
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={cn(
            "flex min-h-[104px] w-full min-w-0 resize-y rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[15px] leading-relaxed text-[var(--text)] placeholder:text-[var(--muted)] outline-none transition-colors duration-[var(--dur-1)] ease-[var(--ease)] focus:border-[var(--border-strong)] focus:outline-none focus-visible:border-[var(--border-strong)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
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
Textarea.displayName = "Textarea";

export { Textarea };
