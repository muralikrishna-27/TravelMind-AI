"use client";

import * as React from "react";
import { fetchTripSnapshot } from "@/lib/api";
import { StreamEventSchema, type TripStatus } from "@/lib/schemas";
import type { TripAction } from "@/lib/trip-machine";

export interface UseTripStreamOptions {
  threadId: string | null;
  status: TripStatus;
  hasPayload?: boolean;
  dispatch: React.Dispatch<TripAction>;
}

export function useTripStream({
  threadId,
  status,
  hasPayload = false,
  dispatch,
}: UseTripStreamOptions): void {
  const isActive =
    status === "streaming" ||
    status === "revising" ||
    (status === "awaiting_approval" && !hasPayload);

  React.useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => {
      dispatch({ type: "TICK_ELAPSED" });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isActive, dispatch]);

  React.useEffect(() => {
    if (!threadId || !isActive) {
      return;
    }

    let closed = false;
    let eventSource: EventSource | null = null;
    let pollTimer: number | null = null;
    let reconnectTimeout: number | null = null;
    let retryAttempt = 0;

    const stopAll = () => {
      closed = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
      if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    const hydrateOnce = async (): Promise<boolean> => {
      if (closed) return false;
      try {
        const snapshot = await fetchTripSnapshot(threadId);
        if (closed) return false;
        dispatch({
          type: "HYDRATE_SNAPSHOT",
          threadId: snapshot.thread_id,
          status: snapshot.status,
          userQuery: snapshot.user_query,
          constraints: snapshot.trip_constraints,
          payload: snapshot.payload,
          steps: snapshot.steps,
          traces: snapshot.traces,
          elapsedSeconds: snapshot.elapsed,
          error: snapshot.error,
        });
        if (
          snapshot.status !== "streaming" &&
          snapshot.status !== "revising" &&
          snapshot.status !== "submitting" &&
          (snapshot.payload || snapshot.status === "blocked" || snapshot.status === "error")
        ) {
          stopAll();
          return true;
        }
      } catch {
        // Ignore transient snapshot error while streaming
      }
      return false;
    };

    const startPollingFallback = () => {
      if (closed || pollTimer !== null) return;
      void hydrateOnce();
      pollTimer = window.setInterval(() => {
        void hydrateOnce();
      }, 2000);
    };

    const connectSse = () => {
      if (closed) return;
      try {
        const es = new EventSource(
          `/api/travel/${encodeURIComponent(threadId)}/events`
        );
        eventSource = es;

        es.onmessage = (evt: MessageEvent<string>) => {
          if (closed) return;
          try {
            const raw: unknown = JSON.parse(evt.data);
            const parsed = StreamEventSchema.safeParse(raw);
            if (!parsed.success) {
              return;
            }
            const event = parsed.data;
            dispatch({ type: "STREAM_EVENT", event });

            if (event.type === "interrupt") {
              // Ensure payload is hydrated even if final event was omitted or delayed
              window.setTimeout(() => {
                if (!closed) {
                  void hydrateOnce();
                }
              }, 400);
              return;
            }

            if (
              event.type === "final" ||
              event.type === "error" ||
              (event.type === "guardrail" && !event.allowed)
            ) {
              stopAll();
            }
          } catch {
            // Safely ignore malformed JSON frames
          }
        };

        es.onerror = () => {
          if (closed) return;
          es.close();
          eventSource = null;
          void hydrateOnce().then((finished) => {
            if (finished || closed) return;
            retryAttempt += 1;
            if (retryAttempt <= 2) {
              const delay = Math.min(1000 * 2 ** (retryAttempt - 1), 3000);
              reconnectTimeout = window.setTimeout(connectSse, delay);
            } else {
              startPollingFallback();
            }
          });
        };
      } catch {
        startPollingFallback();
      }
    };

    connectSse();

    return () => {
      stopAll();
    };
  }, [threadId, isActive, dispatch]);
}
