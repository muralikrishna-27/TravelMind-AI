import * as React from "react";
import { SafeMarkdown } from "@/components/review/safe-markdown";
import { cn } from "@/lib/utils";

export interface ItineraryRowProps {
  time: string;
  activity: string;
  cost: string;
  isLast?: boolean;
  className?: string;
}

export function ItineraryRow({
  time,
  activity,
  cost,
  isLast = false,
  className,
}: ItineraryRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[60px_1fr_auto] items-baseline gap-3 py-4 sm:grid-cols-[88px_1fr_auto] sm:gap-4",
        !isLast && "border-b border-border",
        className
      )}
    >
      <div className="font-mono text-[13px] font-medium text-muted shrink-0">
        {time || "—"}
      </div>
      <div className="text-[15px] leading-[1.5] text-text [&_p]:text-text [&_p]:m-0">
        <SafeMarkdown
          content={activity}
          className="space-y-1 text-[15px] [&_p]:text-text"
        />
      </div>
      {cost ? (
        <div className="font-mono text-[14px] font-medium text-text sm:text-right shrink-0">
          {cost}
        </div>
      ) : null}
    </div>
  );
}
