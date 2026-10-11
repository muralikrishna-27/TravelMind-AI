import * as React from "react";
import { LangGraphLogo } from "@/components/landing/logos/langgraph-logo";
import { GroqLogo } from "@/components/landing/logos/groq-logo";
import { TavilyLogo } from "@/components/landing/logos/tavily-logo";
import { AviationStackLogo } from "@/components/landing/logos/aviationstack-logo";
import { OpenWeatherLogo } from "@/components/landing/logos/openweather-logo";
import { cn } from "@/lib/utils";

export interface TechProviderItem {
  name: string;
  href: string;
  Logo: React.ComponentType<{ className?: string }>;
}

export const TECH_PROVIDERS: TechProviderItem[] = [
  {
    name: "LangGraph",
    href: "https://www.langchain.com/langgraph",
    Logo: LangGraphLogo,
  },
  {
    name: "Groq",
    href: "https://groq.com",
    Logo: GroqLogo,
  },
  {
    name: "Tavily",
    href: "https://tavily.com",
    Logo: TavilyLogo,
  },
  {
    name: "AviationStack",
    href: "https://aviationstack.com",
    Logo: AviationStackLogo,
  },
  {
    name: "OpenWeather",
    href: "https://openweathermap.org",
    Logo: OpenWeatherLogo,
  },
];

export interface TechLogoStripProps {
  className?: string;
}

export function TechLogoStrip({ className }: TechLogoStripProps) {
  return (
    <div
      aria-label="Technology stack"
      className={cn("mt-9 flex w-full flex-col items-center gap-4", className)}
    >
      <p className="text-[13px] font-normal tracking-[0.01em] text-[var(--muted)]">
        Built on
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3.5 sm:gap-x-10 sm:gap-y-5">
        {TECH_PROVIDERS.map(({ name, href, Logo }) => (
          <li key={name} className="flex items-center">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={name}
              className="inline-flex items-center rounded-[var(--r-sm)] px-1 py-0.5 text-[var(--muted)] opacity-80 transition-[color,opacity] duration-[var(--dur-2)] ease-[var(--ease)] hover:text-[var(--text)] hover:opacity-100 focus-visible:text-[var(--text)] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--text)]"
            >
              <Logo className="h-[22px] w-auto sm:h-[24px]" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
