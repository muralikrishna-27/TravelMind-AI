import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function CtaPanel() {
  return (
    <section className="mx-auto w-full max-w-[var(--container)] px-4 py-12 sm:px-6 sm:py-16">
      <Card className="relative overflow-hidden px-6 py-16 text-center sm:px-12 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--glow)] to-transparent"
        />
        <div className="relative mx-auto flex max-w-xl flex-col items-center">
          <h2 className="h2 text-[var(--text)]">
            Nothing is final until you say so.
          </h2>
          <p className="mt-3 text-sm text-[var(--muted)] sm:text-base">
            Describe your trip and let the agents start.
          </p>
          <div className="mt-7">
            <Button asChild variant="primary" size="md" className="px-6">
              <Link href="/app">Start planning</Link>
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}
