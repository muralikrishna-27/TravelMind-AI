import * as React from "react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { type GalleryCardItem } from "@/components/landing/gallery-cards";
import { cn } from "@/lib/utils";

export interface GalleryCardProps {
  card: GalleryCardItem;
  staggered?: boolean;
  isClone?: boolean;
  className?: string;
}

export const GalleryCard = React.forwardRef<HTMLDivElement, GalleryCardProps>(
  function GalleryCard(
    { card, staggered = false, isClone = false, className },
    ref
  ) {
    return (
      <Card
        ref={ref}
        aria-hidden={isClone ? "true" : undefined}
        inert={isClone ? true : undefined}
        data-gallery-card={isClone ? "clone" : "primary"}
        className={cn(
          "flex min-h-[232px] w-[220px] shrink-0 snap-start flex-col justify-between border border-[var(--border)] bg-[var(--surface)] p-5 sm:w-[240px]",
          staggered && "translate-y-7",
          className
        )}
      >
        <div>
          <div className="mb-4">
            <Chip
              asSpan
              className="gap-1.5 border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text-2)]"
            >
              {card.liveDot && (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-[var(--r-pill)] bg-[var(--live)]"
                />
              )}
              <span>{card.tag}</span>
            </Chip>
          </div>
          <h2 className="mb-4 font-serif text-2xl font-normal tracking-[-0.01em] text-[var(--text)]">
            {card.title}
          </h2>
        </div>

        {card.traceLines ? (
          <div className="mono space-y-1.5 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-2)]">
            {card.traceLines.map((line, idx) => {
              const isLast = idx === card.traceLines!.length - 1;
              return (
                <p key={line} className="flex items-center gap-1.5 truncate">
                  <span className="truncate">{line}</span>
                  {isLast && (
                    <span
                      aria-hidden="true"
                      className="animate-trace-cursor inline-block h-3 w-1.5 shrink-0 bg-[var(--live)]"
                    />
                  )}
                </p>
              );
            })}
          </div>
        ) : (
          <dl className="divide-y divide-[var(--border)] text-xs">
            {card.rows?.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-2 py-2.5 first:pt-1 last:pb-0"
              >
                <dt className="text-[var(--text-2)]">{row.label}</dt>
                <dd className="text-[var(--muted)]">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    );
  }
);
