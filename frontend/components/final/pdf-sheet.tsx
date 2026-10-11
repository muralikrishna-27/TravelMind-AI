import * as React from "react";
import { SafeMarkdown } from "@/components/review/safe-markdown";
import type { ParsedItinerary } from "@/lib/parse-itinerary";
import type { TripConstraints, TravelPayload } from "@/lib/schemas";

export interface PdfSheetProps {
  parsed: ParsedItinerary;
  constraints?: TripConstraints | null;
  payload?: TravelPayload | null;
}

export const PdfSheet = React.forwardRef<HTMLDivElement, PdfSheetProps>(
  function PdfSheet({ parsed, constraints, payload }, ref) {
    const destination = constraints?.destination || "Travel Itinerary";
    const metaParts: string[] = [];
    if (constraints?.duration) metaParts.push(constraints.duration);
    if (constraints?.budget) metaParts.push(`Budget: ${constraints.budget}`);
    if (constraints?.origin) metaParts.push(`From: ${constraints.origin}`);

    return (
      <div
        ref={ref}
        data-theme="light"
        className="bg-surface text-text p-8 max-w-[780px] mx-auto space-y-6"
      >
        <div className="border-b border-border pb-5">
          <p className="label mb-1.5">TRAVELMIND AI ITINERARY</p>
          <h1 className="font-serif text-[36px] leading-[1.1] text-text">
            {destination}
          </h1>
          {metaParts.length > 0 ? (
            <p className="mt-2 font-mono text-[13px] text-muted">
              {metaParts.join(" · ")}
            </p>
          ) : null}
        </div>

        {parsed.days.length > 0 ? (
          <div className="space-y-6">
            {parsed.days.map((day) => (
              <div
                key={day.dayNumber}
                className="rounded-md border border-border p-5 break-inside-avoid"
              >
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <div>
                    <p className="label mb-1">DAY {day.dayNumber}</p>
                    <h2 className="font-serif text-[24px] text-text">
                      {day.title}
                    </h2>
                  </div>
                  {day.dayTotal ? (
                    <span className="font-mono text-[12px] text-muted">
                      Est. {day.dayTotal}
                    </span>
                  ) : null}
                </div>

                {day.rows.length > 0 ? (
                  <div className="divide-y divide-border border-t border-border">
                    {day.rows.map((row, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[84px_1fr_auto] gap-3 py-2.5 text-[13px]"
                      >
                        <span className="font-mono text-muted">
                          {row.time || "—"}
                        </span>
                        <span className="text-text">{row.activity}</span>
                        <span className="font-mono text-text">{row.cost}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <SafeMarkdown content={day.rawMarkdown} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <SafeMarkdown content={parsed.rawMarkdown} />
        )}

        {parsed.summaryMarkdown ? (
          <div className="rounded-md border border-border p-5 break-inside-avoid">
            <p className="label mb-2">SUMMARY &amp; COSTS</p>
            <SafeMarkdown content={parsed.summaryMarkdown} />
          </div>
        ) : null}

        {payload?.budget_results ? (
          <div className="rounded-md border border-border p-5 break-inside-avoid">
            <p className="label mb-2">BUDGET ANALYSIS</p>
            <SafeMarkdown content={payload.budget_results} />
          </div>
        ) : null}
      </div>
    );
  }
);
