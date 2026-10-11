"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--bg)] px-4 text-center text-[var(--text)]">
      <p className="label mb-3">Unexpected error</p>
      <h1 className="h1 max-w-[18ch]">Something went off course.</h1>
      <p className="mt-4 max-w-[46ch] text-base text-[var(--muted)]">
        {error?.message || "An unexpected error occurred while rendering this view."}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="primary" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="ghost">
          <Link href="/app">Back to planner</Link>
        </Button>
      </div>
    </main>
  );
}
