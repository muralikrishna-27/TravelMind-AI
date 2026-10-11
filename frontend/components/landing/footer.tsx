import * as React from "react";

export function Footer() {
  return (
    <footer className="mx-auto flex w-full max-w-[var(--container)] items-center justify-between gap-4 px-4 py-8 text-xs text-[var(--muted)] sm:px-6">
      <span>TravelMind AI</span>
      <span>An AI powered travel planner</span>
    </footer>
  );
}
