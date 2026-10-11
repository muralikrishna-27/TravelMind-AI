"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PromptPillProps {
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  onSubmitPrompt?: (value: string) => void;
  className?: string;
}

export function PromptPill({
  defaultValue = "",
  placeholder = "5 days in Tokyo, food and temples",
  disabled = false,
  onSubmitPrompt,
  className,
}: PromptPillProps) {
  const router = useRouter();
  const [value, setValue] = React.useState(defaultValue);
  const inputId = React.useId();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim() || placeholder;
    if (onSubmitPrompt) {
      onSubmitPrompt(trimmed);
      return;
    }
    router.push(`/app?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "mx-auto flex w-full max-w-[540px] items-center gap-2 rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface)] p-1.5 pl-5 shadow-[0_14px_40px_rgba(11,18,14,0.08)] transition-colors duration-[var(--dur-1)] focus-within:border-[var(--border-strong)]",
        className
      )}
    >
      <label htmlFor={inputId} className="sr-only">
        Describe your trip
      </label>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        maxLength={1000}
        disabled={disabled}
        className="min-h-[40px] min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[var(--text)] placeholder:text-[var(--muted)] outline-none focus:outline-none focus-visible:outline-none disabled:opacity-50"
      />
      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={disabled}
        className="min-h-[40px] shrink-0 px-5"
      >
        Plan trip
      </Button>
    </form>
  );
}
