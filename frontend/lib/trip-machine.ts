import {
  type AgentStepStatus,
  type StreamEvent,
  type TraceLine,
  type TravelPayload,
  type TripConstraints,
  type TripStatus,
} from "@/lib/schemas";

export interface AgentStepState {
  id: string;
  monogram: string;
  label: string;
  description: string;
  status: AgentStepStatus;
  detail: string;
  durationSec?: number;
  progress: number;
}

export interface TripMachineState {
  threadId: string | null;
  userQuery: string;
  status: TripStatus;
  steps: Record<string, AgentStepState>;
  constraints: TripConstraints;
  supervisorReasoning: string;
  guardrailAllowed: boolean;
  guardrailReason: string;
  traces: TraceLine[];
  elapsedSeconds: number;
  payload: TravelPayload | null;
  error: string | null;
}

export const INITIAL_AGENT_STEPS: Record<string, AgentStepState> = {
  supervisor: {
    id: "supervisor",
    monogram: "S",
    label: "Supervisor",
    description: "Checks the request and picks the agents.",
    status: "queued",
    detail: "Queued",
    progress: 0,
  },
  flight_agent: {
    id: "flight_agent",
    monogram: "F",
    label: "Flights",
    description: "Airports and airlines for your route.",
    status: "queued",
    detail: "Queued",
    progress: 0,
  },
  hotel_agent: {
    id: "hotel_agent",
    monogram: "H",
    label: "Hotels",
    description: "Stays, ratings and amenities.",
    status: "queued",
    detail: "Queued",
    progress: 0,
  },
  weather_agent: {
    id: "weather_agent",
    monogram: "W",
    label: "Weather",
    description: "Current conditions and forecast.",
    status: "queued",
    detail: "Queued",
    progress: 0,
  },
  budget_agent: {
    id: "budget_agent",
    monogram: "B",
    label: "Budget",
    description: "Costs, risks and ways to save.",
    status: "queued",
    detail: "Queued",
    progress: 0,
  },
  itinerary_agent: {
    id: "itinerary_agent",
    monogram: "I",
    label: "Itinerary",
    description: "A day-by-day plan you can revise.",
    status: "queued",
    detail: "Queued",
    progress: 0,
  },
};

export const EMPTY_CONSTRAINTS: TripConstraints = {
  destination: "",
  origin: "",
  duration: "",
  budget: "",
  travel_style: "",
  special_preferences: [],
};

export function createInitialTripState(
  threadId: string | null = null
): TripMachineState {
  return {
    threadId,
    userQuery: "",
    status: "idle",
    steps: structuredClone(INITIAL_AGENT_STEPS),
    constraints: { ...EMPTY_CONSTRAINTS },
    supervisorReasoning: "",
    guardrailAllowed: true,
    guardrailReason: "",
    traces: [],
    elapsedSeconds: 0,
    payload: null,
    error: null,
  };
}

export function formatTraceTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const secs = (total % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export type TripAction =
  | { type: "RESET" }
  | { type: "SUBMIT_START"; userQuery: string; threadId?: string }
  | { type: "STREAM_START"; threadId: string; userQuery?: string }
  | { type: "REVISE_START"; feedback: string }
  | { type: "TICK_ELAPSED" }
  | { type: "STREAM_EVENT"; event: StreamEvent }
  | {
      type: "HYDRATE_SNAPSHOT";
      threadId: string;
      status: TripStatus;
      userQuery?: string;
      constraints?: TripConstraints;
      payload?: TravelPayload | null;
      steps?: Record<string, AgentStepStatus>;
      traces?: TraceLine[];
      elapsedSeconds?: number;
      error?: string;
    }
  | { type: "SET_FINAL_PAYLOAD"; payload: TravelPayload }
  | { type: "SET_ERROR"; message: string };

function mapPayloadToSteps(
  baseSteps: Record<string, AgentStepState>,
  payload: TravelPayload
): Record<string, AgentStepState> {
  const next = structuredClone(baseSteps);
  const selected = new Set(payload.selected_agents || []);

  next.supervisor.status = "done";
  next.supervisor.progress = 100;
  next.supervisor.detail = payload.guardrail_allowed
    ? `Guardrail passed. Routed to ${selected.size || 5} agents.`
    : payload.guardrail_reason || "Guardrail blocked request.";

  for (const key of [
    "flight_agent",
    "hotel_agent",
    "weather_agent",
    "budget_agent",
    "itinerary_agent",
  ]) {
    if (!payload.guardrail_allowed) {
      next[key].status = "skipped";
      next[key].detail = "Skipped";
      next[key].progress = 0;
    } else if (selected.size === 0 || selected.has(key)) {
      next[key].status = "done";
      next[key].detail = "Done";
      next[key].progress = 100;
    } else {
      next[key].status = "skipped";
      next[key].detail = "Skipped";
      next[key].progress = 0;
    }
  }

  return next;
}

export function tripReducer(
  state: TripMachineState,
  action: TripAction
): TripMachineState {
  switch (action.type) {
    case "RESET":
      return createInitialTripState(null);

    case "SUBMIT_START": {
      const fresh = createInitialTripState(action.threadId || state.threadId);
      fresh.userQuery = action.userQuery;
      fresh.status = "submitting";
      fresh.steps.supervisor.status = "running";
      fresh.steps.supervisor.detail = "Validating request…";
      fresh.steps.supervisor.progress = 35;
      return fresh;
    }

    case "STREAM_START": {
      const nextSteps = structuredClone(state.steps);
      if (nextSteps.supervisor.status === "queued") {
        nextSteps.supervisor.status = "running";
        nextSteps.supervisor.detail = "Checking request and routing agents…";
        nextSteps.supervisor.progress = 40;
      }
      return {
        ...state,
        threadId: action.threadId,
        userQuery: action.userQuery ?? state.userQuery,
        status: state.status === "revising" ? "revising" : "streaming",
        steps: nextSteps,
        error: null,
      };
    }

    case "REVISE_START": {
      const nextSteps = structuredClone(state.steps);
      for (const key of Object.keys(nextSteps)) {
        if (key === "itinerary_agent") {
          nextSteps[key].status = "running";
          nextSteps[key].detail = "Rewriting affected day sections…";
          nextSteps[key].progress = 55;
        } else if (nextSteps[key].status !== "skipped") {
          nextSteps[key].status = "done";
          nextSteps[key].progress = 100;
        }
      }
      const nextTraces: TraceLine[] = [
        ...state.traces.map((t) => ({ ...t, active: false })),
        {
          id: `revise-${Date.now()}`,
          time: formatTraceTimestamp(state.elapsedSeconds),
          agent: "itinerary",
          tool: "revise_days",
          status: "running",
          active: true,
        },
      ];
      return {
        ...state,
        status: "revising",
        steps: nextSteps,
        traces: nextTraces,
        error: null,
      };
    }

    case "TICK_ELAPSED":
      if (state.status !== "streaming" && state.status !== "revising") {
        return state;
      }
      return {
        ...state,
        elapsedSeconds: state.elapsedSeconds + 1,
      };

    case "STREAM_EVENT": {
      const { event } = action;

      if (event.type === "step") {
        const nextSteps = structuredClone(state.steps);
        const stepKey = event.agent;
        if (nextSteps[stepKey]) {
          nextSteps[stepKey].status = event.status;
          nextSteps[stepKey].detail =
            event.message ||
            (event.status === "done"
              ? "Done"
              : event.status === "running"
                ? event.tool || "Running"
                : event.status === "skipped"
                  ? "Skipped"
                  : "Failed");
          nextSteps[stepKey].progress =
            event.status === "done"
              ? 100
              : event.status === "running"
                ? 60
                : 0;
          if (event.t > 0 && event.status === "done") {
            nextSteps[stepKey].durationSec = Math.max(1, Math.round(event.t));
          }
        }

        const shortAgent = stepKey.replace(/_agent$/, "");
        const traceStatus =
          event.status === "done"
            ? "done"
            : event.status === "failed"
              ? "failed"
              : "";
        const nextTraces: TraceLine[] = [
          ...state.traces.map((t) => ({ ...t, active: false })),
          {
            id: `${stepKey}-${event.tool}-${state.traces.length}`,
            time: formatTraceTimestamp(event.t || state.elapsedSeconds),
            agent: shortAgent,
            tool: event.tool || event.message || event.status,
            status: traceStatus,
            active: event.status === "running",
          },
        ];

        return {
          ...state,
          steps: nextSteps,
          traces: nextTraces,
          elapsedSeconds:
            event.t > state.elapsedSeconds
              ? Math.floor(event.t)
              : state.elapsedSeconds,
        };
      }

      if (event.type === "constraints") {
        return {
          ...state,
          constraints: {
            ...state.constraints,
            ...event.data,
          },
        };
      }

      if (event.type === "guardrail") {
        if (!event.allowed) {
          return {
            ...state,
            status: "blocked",
            guardrailAllowed: false,
            guardrailReason: event.reason,
          };
        }
        return {
          ...state,
          guardrailAllowed: true,
          guardrailReason: event.reason,
        };
      }

      if (event.type === "interrupt") {
        return {
          ...state,
          status: event.requires_approval ? "awaiting_approval" : state.status,
        };
      }

      if (event.type === "final") {
        const payload = event.payload;
        const nextSteps = mapPayloadToSteps(state.steps, payload);
        const nextStatus: TripStatus =
          payload.guardrail_allowed === false
            ? "blocked"
            : payload.requires_approval
              ? "awaiting_approval"
              : "approved";

        return {
          ...state,
          threadId: payload.thread_id || state.threadId,
          status: nextStatus,
          steps: nextSteps,
          constraints: payload.trip_constraints || state.constraints,
          supervisorReasoning:
            payload.supervisor_reasoning || state.supervisorReasoning,
          guardrailAllowed: payload.guardrail_allowed ?? true,
          guardrailReason: payload.guardrail_reason || "",
          payload,
          traces: state.traces.map((t) => ({ ...t, active: false })),
          error: null,
        };
      }

      if (event.type === "error") {
        return {
          ...state,
          status: "error",
          error: event.message,
          traces: state.traces.map((t) => ({ ...t, active: false })),
        };
      }

      return state;
    }

    case "HYDRATE_SNAPSHOT": {
      const nextSteps = action.payload
        ? mapPayloadToSteps(state.steps, action.payload)
        : structuredClone(state.steps);

      if (action.steps) {
        for (const [k, v] of Object.entries(action.steps)) {
          if (nextSteps[k]) {
            nextSteps[k].status = v;
            nextSteps[k].progress =
              v === "done" ? 100 : v === "running" ? 60 : 0;
            nextSteps[k].detail =
              v === "done"
                ? "Done"
                : v === "running"
                  ? "Working…"
                  : v === "skipped"
                    ? "Skipped"
                    : "Queued";
          }
        }
      }

      return {
        ...state,
        threadId: action.threadId,
        userQuery: action.userQuery ?? state.userQuery,
        status: action.status,
        constraints:
          action.constraints ||
          action.payload?.trip_constraints ||
          state.constraints,
        payload: action.payload ?? state.payload,
        supervisorReasoning:
          action.payload?.supervisor_reasoning || state.supervisorReasoning,
        guardrailAllowed: action.payload?.guardrail_allowed ?? true,
        guardrailReason: action.payload?.guardrail_reason || "",
        steps: nextSteps,
        traces: action.traces ?? state.traces,
        elapsedSeconds: action.elapsedSeconds ?? state.elapsedSeconds,
        error: action.error || null,
      };
    }

    case "SET_FINAL_PAYLOAD": {
      const payload = action.payload;
      const nextSteps = mapPayloadToSteps(state.steps, payload);
      const nextStatus: TripStatus =
        payload.guardrail_allowed === false
          ? "blocked"
          : payload.requires_approval
            ? "awaiting_approval"
            : "approved";

      return {
        ...state,
        threadId: payload.thread_id || state.threadId,
        status: nextStatus,
        steps: nextSteps,
        constraints: payload.trip_constraints || state.constraints,
        supervisorReasoning: payload.supervisor_reasoning || "",
        guardrailAllowed: payload.guardrail_allowed ?? true,
        guardrailReason: payload.guardrail_reason || "",
        payload,
        traces: state.traces.map((t) => ({ ...t, active: false })),
        error: null,
      };
    }

    case "SET_ERROR":
      return {
        ...state,
        status: "error",
        error: action.message,
        traces: state.traces.map((t) => ({ ...t, active: false })),
      };

    default:
      return state;
  }
}
