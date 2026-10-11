import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  "5 days in Tokyo, mid-range budget, love food and temples",
  "Dubai weekend from Hyderabad with flights and hotels",
  "7 days in Thailand on a budget with street food and beaches",
];

export interface BlockedStateProps {
  reason: string;
  onSelectExample?: (prompt: string) => void;
  onNewTrip?: () => void;
  className?: string;
}

export function BlockedState({
  reason,
  onSelectExample,
  onNewTrip,
  className,
}: BlockedStateProps) {
  return (
    <Card
      role="alert"
      className={cn("mx-auto max-w-xl p-6 sm:p-8", className)}
    >
      <div className="mb-4">
        <Badge variant="warn" dot>
          Guardrail paused request
        </Badge>
      </div>
      <div className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldAlert
            className="h-5 w-5 shrink-0 text-[var(--warn-fg)]"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <h2 className="h2 text-2xl text-[var(--text)]">
            This request needs a travel focus
          </h2>
        </div>
        <p className="max-w-[60ch] text-[15px] text-[var(--text-2)]">
          {reason ||
            "TravelMind AI plans trips between 1 and 7 days, including flights, hotels, weather, budgets, and day-by-day itineraries."}
        </p>
      </div>

      {onSelectExample && (
        <div className="mb-6 space-y-2.5">
          <p className="label">Try an example request</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <Chip
                key={prompt}
                onClick={() => onSelectExample(prompt)}
                className="text-left text-xs whitespace-normal"
              >
                {prompt}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {onNewTrip && (
        <Button variant="primary" onClick={onNewTrip}>
          Start a new trip
        </Button>
      )}
    </Card>
  );
}
