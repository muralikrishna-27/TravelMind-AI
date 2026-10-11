import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { StatusPill } from "@/components/brand/status-pill";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AgentNode } from "@/components/agents/agent-node";
import { TracePanel } from "@/components/agents/trace-panel";
import { ItineraryView } from "@/components/review/itinerary-view";
import { TechLogoStrip } from "@/components/landing/tech-logo-strip";
import { parseItinerary } from "@/lib/parse-itinerary";
import type { TraceLine } from "@/lib/schemas";

const SAMPLE_TRACES: TraceLine[] = [
  {
    id: "t1",
    time: "00:01",
    agent: "supervisor",
    tool: "extract_constraints → Tokyo · 5d · $2,400 · food, temples",
    status: "done",
    active: false,
  },
  {
    id: "t2",
    time: "00:03",
    agent: "flight",
    tool: "aviationstack.flights → SFO → HND · 6 options",
    status: "done",
    active: false,
  },
  {
    id: "t3",
    time: "00:05",
    agent: "weather",
    tool: "openweather.forecast → Tokyo · 5-day · 14–21°C, 1 rain day",
    status: "done",
    active: false,
  },
  {
    id: "t4",
    time: "00:09",
    agent: "hotel",
    tool: 'tavily.search "Shinjuku boutique hotel under $180"',
    status: "",
    active: true,
  },
];

const SAMPLE_MD = `### Day 2 – Old Tokyo and waterfront
| Time | Activity | Estimated Cost ($) |
| --- | --- | --- |
| 08:30 | Senso-ji & Nakamise-dori before crowds | $8 |
| 11:30 | Kappabashi kitchenware street walk | $0 |
| 13:00 | Tempura lunch at Daikokuya | $28 |
| 15:30 | Water bus down the Sumida to Hamarikyu Gardens | $18 |
| 19:00 | Monjayaki dinner on Tsukishima Monja Street | $34 |
**Day 2 Total:** $88
`;

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const parsed = parseItinerary(SAMPLE_MD);

  return (
    <div className="min-h-screen bg-bg text-text py-12 px-6">
      <div className="mx-auto max-w-[var(--container-app)] space-y-12">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <div className="flex items-center gap-4">
            <Logo />
            <Badge variant="live" dot>
              Dev Styleguide
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status="online" />
            <ThemeToggle />
          </div>
        </header>

        <section className="space-y-4">
          <p className="label">TYPOGRAPHY</p>
          <h1 className="h1">Trips planned by a team of agents.</h1>
          <h2 className="h2">See everything. Decide everything.</h2>
          <h3 className="h3">Section heading (Geist 500)</h3>
          <p className="text-text-2 max-w-2xl">
            Body copy in Geist. Six specialists research flights, hotels,
            weather, budget, and daily rhythm in parallel. Nothing is final
            until you approve.
          </p>
          <p className="mono text-muted">
            00:03 flight_agent aviationstack.flights → SFO → HND · 6 options
          </p>
        </section>

        <section className="space-y-4">
          <p className="label">BUTTONS, CHIPS &amp; BADGES</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary button</Button>
            <Button variant="ghost">Ghost button</Button>
            <Button variant="subtle">Subtle button</Button>
            <Button variant="danger">Danger button</Button>
            <Button variant="primary" loading>
              Loading
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip>Japan, 5 days</Chip>
            <Chip selected>Selected chip</Chip>
            <Badge variant="default">Default badge</Badge>
            <Badge variant="live" dot>
              Live / Approved
            </Badge>
            <Badge variant="warn" dot>
              Awaiting your approval
            </Badge>
            <Badge variant="danger" dot>
              Error / Blocked
            </Badge>
          </div>
        </section>

        <section className="space-y-4">
          <p className="label">INPUTS</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input placeholder="5 days in Tokyo, food and temples" />
            <Textarea placeholder="Tell the agents what to change..." />
          </div>
        </section>

        <section className="space-y-4">
          <p className="label">AGENT NODES &amp; LIVE TRACE</p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-1">
              <AgentNode
                monogram="S"
                label="Supervisor"
                status="done"
                detail="Extracted destination, 5 days, $2,400 budget, food & temples focus"
                durationSec={1}
              />
              <AgentNode
                monogram="I"
                label="Itinerary synthesis"
                status="running"
                detail="Day-by-day plan with times and costs"
              />
              <AgentNode
                monogram="You"
                label="Your approval"
                status="queued"
                detail="Pause for review · revise any day or approve"
                isGate
                isLast
              />
            </div>
            <TracePanel traces={SAMPLE_TRACES} status="streaming" />
          </div>
        </section>

        <section className="space-y-4">
          <p className="label">ITINERARY VIEW</p>
          <ItineraryView parsed={parsed} />
        </section>

        <section className="space-y-6">
          <p className="label">TECH LOGO STRIP (DESKTOP &amp; 360PX MOBILE)</p>
          <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
            <TechLogoStrip className="mt-0" />
          </div>
          <div className="mx-auto w-full max-w-[360px] rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="label mb-3 text-center">360px mobile preview</p>
            <TechLogoStrip className="mt-0" />
          </div>
        </section>
      </div>
    </div>
  );
}
