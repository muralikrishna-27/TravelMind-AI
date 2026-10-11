"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface PromptCardProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  error?: string | null;
  className?: string;
}

export function PromptCard({
  value,
  onChange,
  onSubmit,
  loading = false,
  disabled = false,
  error,
  className,
}: PromptCardProps) {
  const textareaId = React.useId();
  const errorId = `${textareaId}-error`;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      if (!loading && !disabled) {
        onSubmit();
      }
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loading && !disabled) {
      onSubmit();
    }
  };

  return (
    <Card
      className={cn(
        "mx-auto w-full max-w-[680px] p-5 shadow-[0_18px_50px_rgba(11,18,14,0.05)] transition-colors duration-[var(--dur-1)] focus-within:border-[var(--border-strong)] sm:p-6",
        className
      )}
    >
      <form onSubmit={handleFormSubmit} className="flex flex-col gap-3">
        <label htmlFor={textareaId} className="label text-left">
          Your trip
        </label>

        <textarea
          id={textareaId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="5 days in Tokyo, mid-range budget, love food and temples"
          maxLength={1000}
          disabled={loading || disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          rows={3}
          className="min-h-[96px] w-full resize-none border-0 bg-transparent text-lg leading-relaxed text-[var(--text)] placeholder:text-[var(--muted)] outline-none focus:outline-none focus-visible:outline-none disabled:opacity-50"
        />

        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-left text-xs font-medium text-[var(--danger-fg)]"
          >
            {error}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[var(--muted)]">
            Ctrl + Enter to send
          </span>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            loadingText="Starting…"
            disabled={disabled}
          >
            Plan my trip
          </Button>
        </div>
      </form>
    </Card>
  );
}
