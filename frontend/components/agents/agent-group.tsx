import * as React from "react";
import { Card } from "@/components/ui/card";
import { type AgentStepState } from "@/lib/trip-machine";
import { cn } from "@/lib/utils";

export interface AgentGroupProps {
  agents: AgentStepState[];
  title?: string;
  className?: string;
}

export function AgentGroup({
  agents,
  title = "Researching in parallel",
  className,
}: AgentGroupProps) {
  const anyRunning = agents.some((a) => a.status === "running");
  const allDone =
    agents.length > 0 &&
    agents.every((a) => a.status === "done" || a.status === "skipped");
  const anyFailed = agents.some((a) => a.status === "failed");

  return (
    <div className={cn("grid grid-cols-[40px_1fr] gap-3.5 sm:gap-4", className)}>
      <div className="flex flex-col items-center">
        <div
          aria-hidden="true"
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-pill)] text-xs font-semibold transition-colors duration-[var(--dur-2)]",
            anyRunning &&
              "animate-live-ring border-2 border-[var(--live)] bg-[var(--surface)] text-[var(--live)] ring-4 ring-[var(--live-soft)]",
            !anyRunning &&
              allDone &&
              "bg-[var(--primary-bg)] text-[var(--primary-fg)]",
            !anyRunning &&
              !allDone &&
              !anyFailed &&
              "bg-[var(--surface-2)] text-[var(--muted)]",
            anyFailed &&
              "border-2 border-[var(--danger-fg)] bg-[var(--danger-bg)] text-[var(--danger-fg)]"
          )}
        >
          {agents.length}
        </div>
        <div
          aria-hidden="true"
          className="my-1.5 w-px flex-1 bg-[var(--border-strong)]/70"
        />
      </div>

      <div className="pb-4">
        <p className="mb-2.5 pt-2 text-xs text-[var(--muted)]">{title}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {agents.map((agent) => {
            const isRunning = agent.status === "running";
            const isDone = agent.status === "done";
            const progressWidth = isDone
              ? 100
              : isRunning
                ? Math.max(45, agent.progress)
                : 0;

            return (
              <Card
                key={agent.id}
                variant={isRunning ? "active" : "default"}
                className={cn(
                  "flex flex-col justify-between gap-3 p-4",
                  agent.status === "failed" && "border-[var(--danger-fg)]"
                )}
              >
                <div>
                  <h3 className="text-[15px] font-medium text-[var(--text)]">
                    {agent.label}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                    {agent.detail}
                  </p>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${agent.label} progress`}
                  aria-valuenow={progressWidth}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1 w-full overflow-hidden rounded-[var(--r-pill)] bg-[var(--surface-2)]"
                >
                  <div
                    className={cn(
                      "h-full rounded-[var(--r-pill)] transition-all duration-[var(--dur-3)] ease-[var(--ease)]",
                      agent.status === "failed"
                        ? "bg-[var(--danger-fg)]"
                        : "bg-[var(--primary-bg)]"
                    )}
                    style={{ width: `${progressWidth}%` }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
