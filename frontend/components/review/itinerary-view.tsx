"use client";

import * as React from "react";
import { DayTabs } from "@/components/review/day-tabs";
import { ItineraryRow } from "@/components/review/itinerary-row";
import { SafeMarkdown } from "@/components/review/safe-markdown";
import type { ParsedItinerary } from "@/lib/parse-itinerary";

export interface ItineraryViewProps {
  parsed: ParsedItinerary;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function ItineraryView({
  parsed,
  activeTab: controlledTab,
  onTabChange,
}: ItineraryViewProps) {
  const defaultTab =
    parsed.days.length > 0 ? parsed.days[0].id : "summary";
  const [internalTab, setInternalTab] = React.useState<string>(defaultTab);

  const candidateTab = controlledTab ?? internalTab;
  const hasSummary = Boolean(
    parsed.summaryMarkdown && parsed.summaryMarkdown.trim().length > 0
  );
  const tabExists =
    (candidateTab === "summary" && hasSummary) ||
    parsed.days.some((d) => d.id === candidateTab);
  const activeTab = tabExists ? candidateTab : defaultTab;

  const handleTabChange = (next: string) => {
    setInternalTab(next);
    onTabChange?.(next);
  };

  if (parsed.days.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 sm:p-8">
        <SafeMarkdown content={parsed.rawMarkdown} />
      </div>
    );
  }

  const currentDay = parsed.days.find((d) => d.id === activeTab);

  return (
    <div className="space-y-4">
      <DayTabs
        days={parsed.days}
        hasSummary={hasSummary}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {activeTab === "summary" && hasSummary ? (
        <div className="rounded-lg border border-border bg-surface p-6 sm:p-8">
          <p className="label mb-2">TRIP SUMMARY</p>
          <h2 className="font-serif text-[28px] leading-[1.15] tracking-[-0.015em] text-text mb-5 sm:text-[32px]">
            Overview &amp; estimated costs
          </h2>
          <SafeMarkdown content={parsed.summaryMarkdown} />
        </div>
      ) : currentDay ? (
        <div className="rounded-lg border border-border bg-surface p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="label mb-1.5">DAY {currentDay.dayNumber}</p>
              <h2 className="font-serif text-[28px] leading-[1.15] tracking-[-0.015em] text-text sm:text-[34px]">
                {currentDay.title}
              </h2>
            </div>
            {currentDay.dayTotal ? (
              <span className="font-mono text-[13px] font-medium text-muted">
                Est. {currentDay.dayTotal}
              </span>
            ) : null}
          </div>

          {currentDay.rows.length > 0 ? (
            <div className="divide-y divide-border border-t border-border">
              {currentDay.rows.map((row, idx) => (
                <ItineraryRow
                  key={`${currentDay.dayNumber}-${idx}`}
                  time={row.time}
                  activity={row.activity}
                  cost={row.cost}
                  isLast={idx === currentDay.rows.length - 1}
                />
              ))}
            </div>
          ) : (
            <SafeMarkdown content={currentDay.rawMarkdown} />
          )}

          {currentDay.rows.length > 0 && currentDay.extraMarkdown ? (
            <div className="mt-5 border-t border-border pt-4">
              <SafeMarkdown content={currentDay.extraMarkdown} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
