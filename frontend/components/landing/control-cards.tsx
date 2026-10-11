import * as React from "react";
import { Card } from "@/components/ui/card";

export function ControlCards() {
  return (
    <section
      id="how-it-works"
      className="mx-auto w-full max-w-[var(--container)] px-4 py-16 sm:px-6 sm:py-20"
    >
      <div className="mb-8 space-y-2">
        <p className="label">Built for control</p>
        <h2 className="h2 text-[var(--text)]">
          See everything. Decide everything.
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex flex-col justify-between p-6">
          <p className="label mb-4">Live trace</p>
          <div className="mono space-y-1 text-[var(--text-2)]">
            <p>flight list_airports done</p>
            <p>hotel search done</p>
            <p className="flex items-center gap-1.5">
              <span>weather get_forecast</span>
              <span
                aria-hidden="true"
                className="animate-trace-cursor inline-block h-3.5 w-2 bg-[var(--live)]"
              />
            </p>
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-6">
          <p className="label mb-4">Revise</p>
          <div className="space-y-1.5">
            <h3 className="h3 text-[var(--text)]">Change one day</h3>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Only affected days are rewritten. The rest stays as is.
            </p>
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-6">
          <p className="label mb-4">Export</p>
          <div className="space-y-1.5">
            <h3 className="h3 text-[var(--text)]">Take it with you</h3>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Copy the plan or download it as a PDF.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
