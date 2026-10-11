"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { type TraceLine } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export interface TracePanelProps {
  traces: TraceLine[];
  status?: "streaming" | "paused" | "error";
  collapsibleOnMobile?: boolean;
  className?: string;
}

export function TracePanel({
  traces,
  status = "streaming",
  collapsibleOnMobile = false,
  className,
}: TracePanelProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [traces, autoScroll]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight <= 24;
    setAutoScroll(isAtBottom);
  };

  const jumpToLatest = () => {
    setAutoScroll(true);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const statusText =
    status === "streaming"
      ? "Streaming"
      : status === "error"
        ? "Interrupted"
        : "Paused";

  return (
    <section
      aria-label="Live execution trace"
      className={cn(
        "relative overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--trace-bg)] p-5 text-[var(--trace-fg)] sm:p-6",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--trace-fg)]/80">
          Live trace
        </span>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-xs font-medium",
              status === "streaming"
                ? "text-[var(--live)]"
                : status === "error"
                  ? "text-[var(--danger-fg)]"
                  : "text-[var(--trace-fg)]/80"
            )}
          >
            {statusText}
          </span>
          {collapsibleOnMobile && (
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand live trace" : "Collapse live trace"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-pill)] text-[var(--trace-fg)]/80 hover:text-[var(--trace-fg)] sm:hidden"
            >
              {collapsed ? (
                <ChevronDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <ChevronUp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Execution trace log"
        aria-live="polite"
        aria-atomic="false"
        tabIndex={0}
        className={cn(
          "mono mt-4 max-h-[260px] overflow-y-auto pr-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--trace-fg)]",
          collapsed && "hidden sm:block"
        )}
      >
        {traces.length === 0 ? (
          <p className="flex items-center gap-1.5 text-[var(--trace-fg)]">
            <span>00:00 supervisor initializing</span>
            {status === "streaming" && (
              <span
                aria-hidden="true"
                className="animate-trace-cursor inline-block h-3.5 w-2 bg-[var(--live)]"
              />
            )}
          </p>
        ) : (
          traces.map((line, index) => {
            const isLast = index === traces.length - 1;
            const showCursor =
              status === "streaming" && (line.active || isLast);
            return (
              <div
                key={line.id}
                className="flex flex-wrap items-center gap-x-2 py-0.5"
              >
                <span className="text-[var(--trace-fg)]/75">{line.time}</span>
                <span>{line.agent}</span>
                <span>{line.tool}</span>
                {line.status && <span>{line.status}</span>}
                {showCursor && (
                  <span
                    aria-hidden="true"
                    className="animate-trace-cursor inline-block h-3.5 w-2 bg-[var(--live)]"
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {!autoScroll && !collapsed && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={jumpToLatest}
            className="rounded-[var(--r-pill)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--text)] cursor-pointer"
          >
            Jump to latest
          </button>
        </div>
      )}
    </section>
  );
}
