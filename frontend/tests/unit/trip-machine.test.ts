import { describe, expect, it } from "vitest";
import { createInitialTripState, tripReducer } from "@/lib/trip-machine";
import { TravelPayloadSchema } from "@/lib/schemas";

describe("tripReducer", () => {
  it("transitions to streaming on STREAM_START and updates steps on STREAM_EVENT", () => {
    const initial = createInitialTripState("thread-1");
    expect(initial.status).toBe("idle");

    const started = tripReducer(initial, {
      type: "STREAM_START",
      threadId: "thread-1",
    });
    expect(started.status).toBe("streaming");

    const afterStep = tripReducer(started, {
      type: "STREAM_EVENT",
      event: {
        type: "step",
        agent: "flight_agent",
        status: "done",
        tool: "aviationstack.flights",
        message: "SFO → HND · 6 options",
        t: 3,
      },
    });

    const flightStep = afterStep.steps.flight_agent;
    expect(flightStep?.status).toBe("done");
    expect(flightStep?.detail).toContain("SFO → HND");
    expect(afterStep.traces).toHaveLength(1);
    expect(afterStep.traces[0].tool).toBe("aviationstack.flights");
  });

  it("transitions to awaiting_approval on interrupt event", () => {
    const started = createInitialTripState("thread-2");
    const interrupted = tripReducer(started, {
      type: "STREAM_EVENT",
      event: {
        type: "interrupt",
        requires_approval: true,
      },
    });

    expect(interrupted.status).toBe("awaiting_approval");
  });

  it("transitions to blocked on guardrail event when allowed is false", () => {
    const started = createInitialTripState("thread-3");
    const blocked = tripReducer(started, {
      type: "STREAM_EVENT",
      event: {
        type: "guardrail",
        allowed: false,
        reason: "Input does not appear to be travel-related.",
      },
    });

    expect(blocked.status).toBe("blocked");
    expect(blocked.guardrailAllowed).toBe(false);
    expect(blocked.guardrailReason).toContain("travel-related");
  });

  it("transitions to approved on final event when requires_approval is false", () => {
    const started = createInitialTripState("thread-4");
    const payload = TravelPayloadSchema.parse({
      thread_id: "thread-4",
      itinerary: "### Day 1 – Arrival",
      requires_approval: false,
      guardrail_allowed: true,
    });
    const finished = tripReducer(started, {
      type: "STREAM_EVENT",
      event: {
        type: "final",
        payload,
      },
    });

    expect(finished.status).toBe("approved");
    expect(finished.steps.itinerary_agent.status).toBe("done");
  });

  it("coerces MCP content block arrays in specialist outputs into markdown strings", () => {
    const payload = TravelPayloadSchema.parse({
      thread_id: "thread-5",
      hotel_results: [
        {
          type: "text",
          text: JSON.stringify({
            query: "Dubai hotels",
            results: [
              {
                title: "Downtown Dubai Hotel",
                url: "https://example.com/dubai-hotel",
                content: "Great central location near Burj Khalifa.",
              },
            ],
          }),
        },
      ],
      requires_approval: true,
    });

    expect(typeof payload.hotel_results).toBe("string");
    expect(payload.hotel_results).toContain("Downtown Dubai Hotel");
    expect(payload.hotel_results).toContain("https://example.com/dubai-hotel");
  });
});
