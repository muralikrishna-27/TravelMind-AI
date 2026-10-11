"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { type StoredThreadItem } from "@/lib/threads";
import { cn } from "@/lib/utils";

export interface RecentTripsProps {
  threads: StoredThreadItem[];
  className?: string;
}

function formatThreadStatus(status: StoredThreadItem["status"]): string {
  switch (status) {
    case "awaiting_approval":
      return "Awaiting your review";
    case "approved":
      return "Approved";
    case "streaming":
    case "revising":
    case "submitting":
      return "Agents at work";
    case "blocked":
      return "Needs travel details";
    case "error":
      return "Interrupted";
    default:
      return "Draft";
  }
}

export function RecentTrips({ threads, className }: RecentTripsProps) {
  if (threads.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Recent trips"
      className={cn("mx-auto w-full max-w-[680px] text-left", className)}
    >
      <p className="label mb-3">Continue where you left off</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {threads.slice(0, 6).map((thread) => (
          <Link
            key={thread.id}
            href={`/app/trip/${encodeURIComponent(thread.id)}`}
            className="group block rounded-[var(--r-lg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]"
          >
            <Card
              variant="interactive"
              className="flex h-full flex-col justify-between gap-1 p-4"
            >
              <h3 className="truncate text-[15px] font-medium text-[var(--text)]">
                {thread.title}
              </h3>
              <p className="text-xs text-[var(--muted)]">
                {formatThreadStatus(thread.status)}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
