"use client";

import * as React from "react";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface OfflineBannerProps {
  onRetry?: () => void;
  className?: string;
}

export function OfflineBanner({ onRetry, className }: OfflineBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "no-print border-b border-[var(--warn-border)] bg-[var(--warn-bg)] px-4 py-2.5 text-sm text-[var(--warn-fg)]",
        className
      )}
    >
      <div className="mx-auto flex max-w-[var(--container-app)] items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <WifiOff className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>
            Planner backend is currently unreachable. Saved trips remain readable.
          </span>
        </div>
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="min-h-[32px] border-[var(--warn-border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text)]"
          >
            Check again
          </Button>
        )}
      </div>
    </div>
  );
}
