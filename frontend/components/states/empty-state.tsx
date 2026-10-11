import * as React from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <Card
      className={cn(
        "flex flex-col items-start justify-between gap-4 p-6 sm:p-8",
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]">
        <Compass className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="max-w-[55ch] space-y-1.5">
        <h2 className="h3 text-[var(--text)]">{title}</h2>
        <p className="text-sm text-[var(--muted)]">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Card>
  );
}
