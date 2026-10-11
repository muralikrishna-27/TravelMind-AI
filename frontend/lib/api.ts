import {
  HealthResponseSchema,
  StartTripResponseSchema,
  TravelPayloadSchema,
  TripSnapshotResponseSchema,
  type HealthResponse,
  type TravelPayload,
  type TripSnapshotResponse,
} from "@/lib/schemas";

export class FriendlyApiError extends Error {
  public readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "FriendlyApiError";
    this.status = status;
  }
}

export function toFriendlyErrorMessage(
  status: number,
  rawError?: string
): string {
  if (status === 400) {
    if (rawError && rawError.length < 160 && !rawError.includes("Traceback")) {
      return rawError;
    }
    return "Please check your trip request and try again.";
  }
  if (status === 404) {
    return "We couldn't find that trip session. Start a new trip to continue.";
  }
  if (status === 429) {
    return "Our travel agents are handling a high volume of requests. Please wait a moment and try again.";
  }
  if (rawError && /Trip duration cannot exceed/i.test(rawError)) {
    return rawError;
  }
  return "We couldn't complete this step right now. Please try again or start a new trip.";
}

export async function startTripRequest(
  message: string,
  threadId?: string | null
): Promise<{
  threadId: string;
  immediatePayload?: TravelPayload;
}> {
  let response: Response;
  try {
    response = await fetch("/api/travel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message.trim().slice(0, 1000),
        thread_id: threadId || undefined,
      }),
    });
  } catch {
    throw new FriendlyApiError(
      "Unable to reach the travel planner service. Check your connection and try again.",
      0
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new FriendlyApiError(toFriendlyErrorMessage(response.status), response.status);
  }

  const record =
    typeof json === "object" && json !== null
      ? (json as Record<string, unknown>)
      : {};

  if (!response.ok || record.success === false) {
    const rawErr =
      typeof record.error === "string" ? record.error : undefined;
    throw new FriendlyApiError(
      toFriendlyErrorMessage(response.status, rawErr),
      response.status
    );
  }

  const parsedStart = StartTripResponseSchema.safeParse(record);
  if (!parsedStart.success) {
    throw new FriendlyApiError(
      "Received an unexpected response from the travel planner.",
      500
    );
  }

  const hasImmediateItinerary =
    typeof record.itinerary === "string" || typeof record.answer === "string";

  if (hasImmediateItinerary && record.status !== "streaming") {
    const payloadParse = TravelPayloadSchema.safeParse(record);
    if (payloadParse.success) {
      return {
        threadId: parsedStart.data.thread_id,
        immediatePayload: payloadParse.data,
      };
    }
  }

  return {
    threadId: parsedStart.data.thread_id,
  };
}

export async function fetchTripSnapshot(
  threadId: string
): Promise<TripSnapshotResponse> {
  let response: Response;
  try {
    response = await fetch(`/api/travel/${encodeURIComponent(threadId)}`, {
      method: "GET",
      cache: "no-store",
    });
  } catch {
    throw new FriendlyApiError(
      "Unable to reach the travel planner service.",
      0
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new FriendlyApiError(toFriendlyErrorMessage(response.status), response.status);
  }

  const record =
    typeof json === "object" && json !== null
      ? (json as Record<string, unknown>)
      : {};

  if (!response.ok || record.success === false) {
    const rawErr =
      typeof record.error === "string" ? record.error : undefined;
    throw new FriendlyApiError(
      toFriendlyErrorMessage(response.status, rawErr),
      response.status
    );
  }

  const parsed = TripSnapshotResponseSchema.safeParse(record);
  if (!parsed.success) {
    throw new FriendlyApiError(
      "Could not load the saved trip state.",
      500
    );
  }

  return parsed.data;
}

export async function submitTripApprovalRequest(params: {
  threadId: string;
  approved: boolean;
  feedback?: string;
}): Promise<{
  streaming?: boolean;
  payload?: TravelPayload;
}> {
  let response: Response;
  try {
    response = await fetch("/api/travel/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thread_id: params.threadId,
        approved: params.approved,
        feedback: (params.feedback || "").trim().slice(0, 1000),
      }),
    });
  } catch {
    throw new FriendlyApiError(
      "Unable to reach the travel planner service. Please try again.",
      0
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new FriendlyApiError(toFriendlyErrorMessage(response.status), response.status);
  }

  const record =
    typeof json === "object" && json !== null
      ? (json as Record<string, unknown>)
      : {};

  if (!response.ok || record.success === false) {
    const rawErr =
      typeof record.error === "string" ? record.error : undefined;
    throw new FriendlyApiError(
      toFriendlyErrorMessage(response.status, rawErr),
      response.status
    );
  }

  if (record.status === "streaming" || record.status === "revising") {
    return { streaming: true };
  }

  const parsed = TravelPayloadSchema.safeParse(record);
  if (!parsed.success) {
    throw new FriendlyApiError(
      "Received an unexpected response while updating your itinerary.",
      500
    );
  }

  return { payload: parsed.data };
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health", {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new FriendlyApiError("Service unavailable", response.status);
  }
  const json: unknown = await response.json();
  const parsed = HealthResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new FriendlyApiError("Invalid health response", 500);
  }
  return parsed.data;
}
