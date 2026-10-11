"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ParsedDay } from "@/lib/parse-itinerary";

export interface DayTabsProps {
  days: ParsedDay[];
  hasSummary: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function DayTabs({
  days,
  hasSummary,
  activeTab,
  onTabChange,
}: DayTabsProps) {
  if (days.length === 0) return null;

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <div className="overflow-x-auto no-scrollbar pb-1">
        <TabsList aria-label="Itinerary days">
          {days.map((d) => (
            <TabsTrigger key={d.id} value={d.id}>
              {d.label}
            </TabsTrigger>
          ))}
          {hasSummary ? (
            <TabsTrigger value="summary">Summary</TabsTrigger>
          ) : null}
        </TabsList>
      </div>
      {days.map((d) => (
        <TabsContent key={d.id} value={d.id} className="sr-only" />
      ))}
      {hasSummary ? (
        <TabsContent value="summary" className="sr-only" />
      ) : null}
    </Tabs>
  );
}
