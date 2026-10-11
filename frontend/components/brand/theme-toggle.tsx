"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

function useIsMounted() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useIsMounted();

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "h-[38px] w-[38px] rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface)]",
          className
        )}
      />
    );
  }

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    }
  };

  const label =
    theme === "system"
      ? `Theme: system (${resolvedTheme || "light"}). Click to switch theme`
      : `Theme: ${theme}. Click to switch theme`;

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] transition-colors duration-[var(--dur-1)] ease-[var(--ease)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)] cursor-pointer",
        className
      )}
    >
      {theme === "system" ? (
        <Monitor className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      ) : resolvedTheme === "dark" ? (
        <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Sun className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      )}
    </button>
  );
}
