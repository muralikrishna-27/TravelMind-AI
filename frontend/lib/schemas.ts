import { z } from "zod";

function formatSearchResultsMarkdown(record: Record<string, unknown>): string {
  const results = record.results;
  if (!Array.isArray(results) || results.length === 0) {
    return JSON.stringify(record, null, 2);
  }
  const lines: string[] = ["### Recommended Stays & Sources\n"];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const title = typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : "Hotel option";
    const url = typeof obj.url === "string" ? obj.url.trim() : "";
    const content = typeof obj.content === "string" ? obj.content.trim() : "";
    lines.push(url ? `- **[${title}](${url})**` : `- **${title}**`);
    if (content) {
      lines.push(`  ${content.slice(0, 500)}`);
    }
  }
  return lines.join("\n\n").trim();
}

export function coerceWireText(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.startsWith("{") && trimmed.includes('"results"')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed) &&
          Array.isArray((parsed as Record<string, unknown>).results)
        ) {
          return formatSearchResultsMarkdown(parsed as Record<string, unknown>);
        }
      } catch {
        // Keep raw string
      }
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (item && typeof item === "object" && "text" in item) {
          return coerceWireText((item as Record<string, unknown>).text);
        }
        return coerceWireText(item);
      })
      .filter(Boolean)
      .join("\n\n");
  }
  if (typeof val === "object") {
    const rec = val as Record<string, unknown>;
    if (Array.isArray(rec.results)) {
      return formatSearchResultsMarkdown(rec);
    }
    if (typeof rec.text === "string") {
      return coerceWireText(rec.text);
    }
    return JSON.stringify(val, null, 2);
  }
  return String(val);
}

const CoercedStringSchema = z.preprocess(coerceWireText, z.string());

export const TripConstraintsSchema = z
  .object({
    destination: CoercedStringSchema.optional().default(""),
    origin: CoercedStringSchema.optional().default(""),
    duration: CoercedStringSchema.optional().default(""),
    budget: CoercedStringSchema.optional().default(""),
    travel_style: CoercedStringSchema.optional().default(""),
    special_preferences: z
      .preprocess(
        (v) =>
          Array.isArray(v)
            ? v.map((x) => coerceWireText(x)).filter(Boolean)
            : typeof v === "string" && v.trim()
              ? [v.trim()]
              : [],
        z.array(z.string())
      )
      .optional()
      .default([]),
  })
  .passthrough();

export type TripConstraints = z.infer<typeof TripConstraintsSchema>;

export const AgentIdSchema = z.enum([
  "supervisor",
  "flight_agent",
  "hotel_agent",
  "weather_agent",
  "budget_agent",
  "itinerary_agent",
]);

export type AgentId = z.infer<typeof AgentIdSchema>;

export const AgentStepStatusSchema = z.enum([
  "queued",
  "running",
  "done",
  "failed",
  "skipped",
]);

export type AgentStepStatus = z.infer<typeof AgentStepStatusSchema>;

export const TravelPayloadSchema = z
  .object({
    thread_id: z.string(),
    answer: CoercedStringSchema.optional().default(""),
    requires_approval: z.boolean().optional().default(false),
    approval_request: CoercedStringSchema.optional().default(""),
    flight_results: CoercedStringSchema.optional().default(""),
    hotel_results: CoercedStringSchema.optional().default(""),
    weather_results: CoercedStringSchema.optional().default(""),
    budget_results: CoercedStringSchema.optional().default(""),
    itinerary: CoercedStringSchema.optional().default(""),
    selected_agents: z.array(z.string()).optional().default([]),
    trip_constraints: TripConstraintsSchema.optional().default({
      destination: "",
      origin: "",
      duration: "",
      budget: "",
      travel_style: "",
      special_preferences: [],
    }),
    supervisor_reasoning: CoercedStringSchema.optional().default(""),
    guardrail_allowed: z.boolean().optional().default(true),
    guardrail_reason: CoercedStringSchema.optional().default(""),
    approved: z.boolean().nullable().optional().default(false),
    human_feedback: CoercedStringSchema.optional().default(""),
    llm_calls: z.number().optional().default(0),
  })
  .passthrough();

export type TravelPayload = z.infer<typeof TravelPayloadSchema>;

export const TripStatusSchema = z.enum([
  "idle",
  "submitting",
  "streaming",
  "blocked",
  "awaiting_approval",
  "revising",
  "approved",
  "error",
]);

export type TripStatus = z.infer<typeof TripStatusSchema>;

export const StepEventSchema = z.object({
  type: z.literal("step"),
  agent: z.string(),
  status: AgentStepStatusSchema,
  tool: z.string().optional().default(""),
  message: z.string().optional().default(""),
  t: z.number().optional().default(0),
});

export const ConstraintsEventSchema = z.object({
  type: z.literal("constraints"),
  data: TripConstraintsSchema,
});

export const GuardrailEventSchema = z.object({
  type: z.literal("guardrail"),
  allowed: z.boolean(),
  reason: z.string().optional().default(""),
});

export const InterruptEventSchema = z.object({
  type: z.literal("interrupt"),
  requires_approval: z.boolean(),
});

export const FinalEventSchema = z.object({
  type: z.literal("final"),
  payload: TravelPayloadSchema,
});

export const ErrorEventSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
});

export const StreamEventSchema = z.discriminatedUnion("type", [
  StepEventSchema,
  ConstraintsEventSchema,
  GuardrailEventSchema,
  InterruptEventSchema,
  FinalEventSchema,
  ErrorEventSchema,
]);

export type StreamEvent = z.infer<typeof StreamEventSchema>;

export const TraceLineSchema = z.object({
  id: z.string(),
  time: z.string(),
  agent: z.string(),
  tool: z.string(),
  status: z.string(),
  active: z.boolean().optional().default(false),
});

export type TraceLine = z.infer<typeof TraceLineSchema>;

export const TripSnapshotResponseSchema = z
  .object({
    success: z.boolean().optional().default(true),
    thread_id: z.string(),
    status: TripStatusSchema,
    user_query: z.string().optional().default(""),
    trip_constraints: TripConstraintsSchema.optional(),
    payload: TravelPayloadSchema.optional().nullable(),
    error: z.string().optional().default(""),
    elapsed: z.number().optional().default(0),
    steps: z.record(z.string(), AgentStepStatusSchema).optional(),
    traces: z.array(TraceLineSchema).optional(),
  })
  .passthrough();

export type TripSnapshotResponse = z.infer<typeof TripSnapshotResponseSchema>;

export const StartTripResponseSchema = z
  .object({
    success: z.boolean().optional().default(true),
    thread_id: z.string(),
    status: TripStatusSchema.optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const HealthResponseSchema = z
  .object({
    status: z.string(),
    message: z.string().optional(),
    features: z.array(z.string()).optional(),
  })
  .passthrough();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
