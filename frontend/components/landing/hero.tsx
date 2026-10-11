import * as React from "react";
import { PromptPill } from "@/components/landing/prompt-pill";
import { TechLogoStrip } from "@/components/landing/tech-logo-strip";

export function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-[var(--container)] flex-col items-center px-4 pt-12 pb-8 text-center sm:px-6 sm:pt-16 sm:pb-10">
      <h1 className="display max-w-[14ch] pb-1 text-[var(--text)]">
        Trips planned by a team of agents.
      </h1>

      <p className="mt-6 max-w-[48ch] text-base leading-relaxed text-[var(--muted)] sm:text-[17px]">
        Watch flights, hotels, weather and budget get researched live. Review
        the plan, change any day, then approve.
      </p>

      <div className="mt-8 w-full">
        <PromptPill />
      </div>

      <TechLogoStrip />
    </section>
  );
}
