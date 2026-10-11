import * as React from "react";
import { Card } from "@/components/ui/card";
import { type TripConstraints } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export interface TripBriefProps {
  constraints: TripConstraints;
  className?: string;
}

export function TripBrief({ constraints, className }: TripBriefProps) {
  const entries = [
    { label: "Destination", value: constraints.destination },
    { label: "Duration", value: constraints.duration },
    { label: "Origin", value: constraints.origin },
    { label: "Budget", value: constraints.budget },
  ].filter((item) => Boolean(item.value && item.value.trim()));

  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="Extracted trip brief"
      className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-4", className)}
    >
      {entries.map((item) => (
        <Card key={item.label} className="px-3.5 py-2.5">
          <p className="label text-[10px]">{item.label}</p>
          <p className="mt-0.5 truncate text-xs font-medium text-[var(--text)]">
            {item.value}
          </p>
        </Card>
      ))}
    </div>
  );
}
