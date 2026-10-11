import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AgentCardSpec {
  key: "supervisor" | "flights" | "hotels" | "weather" | "budget" | "itinerary";
  letter: string;
  title: string;
  description: string;
  bg:
    | "01-supervisor"
    | "02-flights"
    | "03-hotels"
    | "04-weather"
    | "05-budget"
    | "06-itinerary";
}

export const AGENT_CARDS: AgentCardSpec[] = [
  {
    key: "supervisor",
    letter: "S",
    title: "Supervisor",
    description: "Checks the request and picks the agents.",
    bg: "01-supervisor",
  },
  {
    key: "flights",
    letter: "F",
    title: "Flights",
    description: "Airports and airlines for your route.",
    bg: "02-flights",
  },
  {
    key: "hotels",
    letter: "H",
    title: "Hotels",
    description: "Stays, ratings and amenities.",
    bg: "03-hotels",
  },
  {
    key: "weather",
    letter: "W",
    title: "Weather",
    description: "Current conditions and forecast.",
    bg: "04-weather",
  },
  {
    key: "budget",
    letter: "B",
    title: "Budget",
    description: "Costs, risks and ways to save.",
    bg: "05-budget",
  },
  {
    key: "itinerary",
    letter: "I",
    title: "Itinerary",
    description: "A day-by-day plan you can revise.",
    bg: "06-itinerary",
  },
];

export function AgentGrid() {
  return (
    <section
      id="agents"
      className="mx-auto w-full max-w-[var(--container)] px-4 py-14 sm:px-6 sm:py-16"
    >
      <div className="mb-8 space-y-2">
        <p className="label">Meet the agents</p>
        <h2 className="h2 text-[var(--text)]">Six specialists.</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AGENT_CARDS.map((agent) => {
          const isSupervisor = agent.key === "supervisor";
          const bgStyle = {
            "--bg-light": `image-set(url("/agent-card-backgrounds/${agent.bg}-light.webp") type("image/webp"), url("/agent-card-backgrounds/${agent.bg}-light.png") type("image/png"))`,
            "--bg-dark": `image-set(url("/agent-card-backgrounds/${agent.bg}-dark.webp") type("image/webp"), url("/agent-card-backgrounds/${agent.bg}-dark.png") type("image/png"))`,
          } as React.CSSProperties;

          return (
            <Card
              key={agent.key}
              style={bgStyle}
              className="agent-card-bg relative isolate flex min-h-[200px] flex-col justify-between overflow-hidden p-6 sm:aspect-[3/2] sm:min-h-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-10 inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-pill)] text-xs font-semibold",
                  isSupervisor
                    ? "bg-[var(--primary-bg)] text-[var(--primary-fg)]"
                    : "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]"
                )}
              >
                {agent.letter}
              </span>
              <div className="relative z-10 space-y-1">
                <h3 className="h3 text-[var(--text)]">{agent.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  {agent.description}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
