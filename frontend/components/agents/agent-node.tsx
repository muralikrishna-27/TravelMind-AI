import * as React from "react";
import { Card } from "@/components/ui/card";
import { type AgentStepStatus } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export interface AgentNodeProps {
  monogram: string;
  label: string;
  detail: string;
  status: AgentStepStatus;
  durationSec?: number;
  isGate?: boolean;
  isLast?: boolean;
  className?: string;
}

export function AgentNode({
  monogram,
  label,
  detail,
  status,
  durationSec,
  isGate = false,
  isLast = false,
  className,
}: AgentNodeProps) {
  const isMutedTitle = !isGate && (status === "queued" || status === "skipped");

  return (
    <div className={cn("grid grid-cols-[40px_1fr] gap-3.5 sm:gap-4", className)}>
      <div className="flex flex-col items-center">
        <div
          aria-hidden="true"
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-pill)] text-xs font-semibold transition-colors duration-[var(--dur-2)]",
            isGate && "bg-[var(--warn-bg)] text-[var(--warn-fg)]",
            !isGate &&
              status === "done" &&
              "bg-[var(--primary-bg)] text-[var(--primary-fg)]",
            !isGate &&
              status === "running" &&
              "animate-live-ring border-2 border-[var(--live)] bg-[var(--surface)] text-[var(--live)]",
            !isGate &&
              (status === "queued" || status === "skipped") &&
              "bg-[var(--surface-2)] text-[var(--muted)]",
            !isGate &&
              status === "failed" &&
              "border-2 border-[var(--danger-fg)] bg-[var(--danger-bg)] text-[var(--danger-fg)]"
          )}
        >
          {monogram}
        </div>
        {!isLast && (
          <div
            aria-hidden="true"
            className="my-1.5 w-px flex-1 bg-[var(--border-strong)]/70"
          />
        )}
      </div>

      <div className={cn(!isLast && "pb-3.5")}>
        <Card
          variant={
            isGate
              ? "dashed"
              : status === "running"
                ? "active"
                : "default"
          }
          className={cn(
            "px-5 py-4",
            status === "failed" && "border-[var(--danger-fg)]"
          )}
        >
          <div className="flex items-baseline justify-between gap-2">
            <h3
              className={cn(
                "text-[16px] font-medium",
                isMutedTitle ? "text-[var(--muted)]" : "text-[var(--text)]"
              )}
            >
              {label}
            </h3>
            {durationSec !== undefined && durationSec > 0 && (
              <span className="text-xs text-[var(--muted)]">{durationSec}s</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{detail}</p>
        </Card>
      </div>
    </div>
  );
}
