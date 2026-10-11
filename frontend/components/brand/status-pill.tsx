"use client";

import * as React from "react";
import { type HealthStatus } from "@/hooks/use-health";
import { cn } from "@/lib/utils";

export interface StatusPillProps {
  status: HealthStatus;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const label =
    status === "online"
      ? "Online"
      : status === "degraded"
        ? "Degraded"
        : "Offline";

  return (
    <span
      role="status"
      aria-label={`Service status: ${label}`}
      className={cn(
        "inline-flex items-center gap-2 text-sm text-[var(--muted)]",
        className
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-[var(--r-pill)]",
          status === "online"
            ? "bg-[var(--live)]"
            : status === "degraded"
              ? "bg-[var(--warn-fg)]"
              : "bg-[var(--danger-fg)]"
        )}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
