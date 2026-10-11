"use client";

import * as React from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { SafeMarkdown } from "@/components/review/safe-markdown";
import type { TravelPayload } from "@/lib/schemas";

export interface InsightsAccordionProps {
  payload: TravelPayload;
}

interface InsightEntry {
  id: string;
  label: string;
  content: string;
}

export function InsightsAccordion({ payload }: InsightsAccordionProps) {
  const entries: InsightEntry[] = [
    {
      id: "flights",
      label: "Flights",
      content: payload.flight_results ?? "",
    },
    {
      id: "hotels",
      label: "Hotels",
      content: payload.hotel_results ?? "",
    },
    {
      id: "weather",
      label: "Weather",
      content: payload.weather_results ?? "",
    },
    {
      id: "budget",
      label: "Budget",
      content: payload.budget_results ?? "",
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-surface p-6 sm:p-7">
      <p className="label mb-3">AGENT INSIGHTS</p>
      <Accordion type="multiple" className="w-full divide-y divide-border">
        {entries.map((entry) => {
          const hasData = entry.content.trim().length > 0;
          return (
            <AccordionItem
              key={entry.id}
              value={entry.id}
              className="border-b border-border last:border-b-0"
            >
              <AccordionTrigger className="py-3.5 text-[15px] font-medium text-text hover:no-underline group">
                <span>{entry.label}</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-1">
                {hasData ? (
                  <SafeMarkdown content={entry.content} />
                ) : (
                  <p className="text-[14px] text-muted italic">
                    No {entry.label.toLowerCase()} details returned for this
                    trip.
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
