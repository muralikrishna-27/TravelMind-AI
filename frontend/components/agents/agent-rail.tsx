import * as React from "react";
import { AgentGroup } from "@/components/agents/agent-group";
import { AgentNode } from "@/components/agents/agent-node";
import { type AgentStepState } from "@/lib/trip-machine";
import { cn } from "@/lib/utils";

export interface AgentRailProps {
  steps: Record<string, AgentStepState>;
  isRevising?: boolean;
  className?: string;
}

export function AgentRail({
  steps,
  isRevising = false,
  className,
}: AgentRailProps) {
  const supervisor = steps.supervisor;
  const groupAgents = [
    steps.flight_agent,
    steps.hotel_agent,
    steps.weather_agent,
  ].filter(Boolean);
  const budget = steps.budget_agent;
  const itinerary = steps.itinerary_agent;

  return (
    <div aria-label="Agent execution rail" className={cn("w-full", className)}>
      {supervisor && (
        <AgentNode
          monogram={supervisor.monogram}
          label={supervisor.label}
          detail={supervisor.detail}
          status={supervisor.status}
          durationSec={supervisor.durationSec}
        />
      )}

      {groupAgents.length > 0 && (
        <AgentGroup
          agents={groupAgents}
          title={
            isRevising
              ? "Previous research cached"
              : "Researching in parallel"
          }
        />
      )}

      {budget && (
        <AgentNode
          monogram={budget.monogram}
          label={budget.label}
          detail={budget.detail}
          status={budget.status}
          durationSec={budget.durationSec}
        />
      )}

      {itinerary && (
        <AgentNode
          monogram={itinerary.monogram}
          label={itinerary.label}
          detail={itinerary.detail}
          status={itinerary.status}
          durationSec={itinerary.durationSec}
        />
      )}

      <AgentNode
        monogram="You"
        label="Your approval"
        detail="The plan pauses here for your review."
        status="queued"
        isGate
        isLast
      />
    </div>
  );
}
