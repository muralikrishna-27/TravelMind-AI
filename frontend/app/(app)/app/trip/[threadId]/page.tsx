"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppHeader } from "@/components/brand/app-header";
import { AgentRail } from "@/components/agents/agent-rail";
import { TracePanel } from "@/components/agents/trace-panel";
import { TripBrief } from "@/components/agents/trip-brief";
import { ItineraryView } from "@/components/review/itinerary-view";
import { InsightsAccordion } from "@/components/review/insights-accordion";
import { ReviewPanel } from "@/components/review/review-panel";
import { StickyActionBar } from "@/components/review/sticky-action-bar";
import { FinalActions } from "@/components/final/final-actions";
import { PdfSheet } from "@/components/final/pdf-sheet";
import { BlockedState } from "@/components/states/blocked-state";
import { ErrorState } from "@/components/states/error-state";
import { ItinerarySkeleton } from "@/components/states/skeletons";
import { Button } from "@/components/ui/button";
import { useTripStream } from "@/hooks/use-trip-stream";
import {
  fetchTripSnapshot,
  submitTripApprovalRequest,
  FriendlyApiError,
} from "@/lib/api";
import { parseItinerary } from "@/lib/parse-itinerary";
import {
  clearLegacyThreadStorage,
  deriveThreadTitle,
  upsertStoredThread,
} from "@/lib/threads";
import {
  createInitialTripState,
  formatTraceTimestamp,
  tripReducer,
} from "@/lib/trip-machine";
import { TravelPayloadSchema } from "@/lib/schemas";

export default function TripWorkspacePage() {
  const params = useParams<{ threadId: string }>();
  const router = useRouter();
  const threadId = decodeURIComponent(params.threadId || "");

  const [state, dispatch] = React.useReducer(
    tripReducer,
    threadId,
    createInitialTripState
  );
  const [submittingReview, setSubmittingReview] = React.useState(false);
  const [submittingAction, setSubmittingAction] = React.useState<
    "approve" | "revise" | null
  >(null);
  const [isExportingPdf, setIsExportingPdf] = React.useState(false);
  const pdfRef = React.useRef<HTMLDivElement>(null);

  useTripStream({
    threadId,
    status: state.status,
    hasPayload: Boolean(state.payload),
    dispatch,
  });

  // Hydrate initial state on mount
  React.useEffect(() => {
    if (!threadId) return;
    let cancelled = false;

    async function loadSnapshot() {
      const cachedQuery =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(`tm_query_${threadId}`) || ""
          : "";
      const cachedPayloadRaw =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(`tm_payload_${threadId}`)
          : null;

      if (cachedPayloadRaw) {
        try {
          const parsed = TravelPayloadSchema.safeParse(
            JSON.parse(cachedPayloadRaw)
          );
          if (parsed.success) {
            if (!cancelled) {
              dispatch({ type: "SET_FINAL_PAYLOAD", payload: parsed.data });
            }
            return;
          }
        } catch {
          // Ignore invalid cached payload
        }
      }

      try {
        const snapshot = await fetchTripSnapshot(threadId);
        if (cancelled) return;
        dispatch({
          type: "HYDRATE_SNAPSHOT",
          threadId: snapshot.thread_id,
          status: snapshot.status,
          userQuery: snapshot.user_query || cachedQuery,
          constraints: snapshot.trip_constraints,
          payload: snapshot.payload,
          steps: snapshot.steps,
          traces: snapshot.traces,
          elapsedSeconds: snapshot.elapsed,
          error: snapshot.error,
        });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof FriendlyApiError && err.status === 404 && cachedQuery) {
          dispatch({
            type: "STREAM_START",
            threadId,
            userQuery: cachedQuery,
          });
        } else {
          const message =
            err instanceof FriendlyApiError
              ? err.message
              : "Could not load this trip session.";
          dispatch({ type: "SET_ERROR", message });
        }
      }
    }

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  // Persist thread status & title in localStorage recent trips
  React.useEffect(() => {
    if (!threadId || state.status === "idle") return;
    const title = deriveThreadTitle(
      state.userQuery,
      state.constraints.destination,
      state.constraints.duration
    );
    if (title === "Untitled trip" && !state.constraints.destination && !state.userQuery) {
      return;
    }
    upsertStoredThread({
      id: threadId,
      title,
      status: state.status,
      updatedAt: Date.now(),
    });
  }, [
    threadId,
    state.status,
    state.userQuery,
    state.constraints.destination,
    state.constraints.duration,
  ]);

  const handleNewTrip = () => {
    clearLegacyThreadStorage();
    dispatch({ type: "RESET" });
    router.push("/app");
  };

  const handleApprove = async () => {
    if (!threadId || submittingReview) return;
    setSubmittingReview(true);
    setSubmittingAction("approve");
    try {
      const res = await submitTripApprovalRequest({
        threadId,
        approved: true,
      });
      if (res.payload) {
        dispatch({ type: "SET_FINAL_PAYLOAD", payload: res.payload });
        toast.success("Itinerary approved");
      } else if (res.streaming) {
        dispatch({ type: "STREAM_START", threadId });
      }
    } catch (err) {
      const msg =
        err instanceof FriendlyApiError
          ? err.message
          : "Unable to approve the itinerary right now.";
      toast.error(msg);
    } finally {
      setSubmittingReview(false);
      setSubmittingAction(null);
    }
  };

  const handleRevise = async (feedback: string) => {
    if (!threadId || submittingReview) return;
    setSubmittingReview(true);
    setSubmittingAction("revise");

    try {
      const res = await submitTripApprovalRequest({
        threadId,
        approved: false,
        feedback,
      });
      if (res.payload) {
        dispatch({ type: "SET_FINAL_PAYLOAD", payload: res.payload });
        toast.success("Itinerary updated");
      } else if (res.streaming) {
        dispatch({ type: "REVISE_START", feedback });
      }
    } catch (err) {
      const msg =
        err instanceof FriendlyApiError
          ? err.message
          : "Unable to revise the itinerary right now.";
      dispatch({ type: "SET_ERROR", message: msg });
      toast.error(msg);
    } finally {
      setSubmittingReview(false);
      setSubmittingAction(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default;
      const element = pdfRef.current;
      if (!element) {
        window.print();
        return;
      }
      const slug = (state.constraints.destination || "travelmind-itinerary")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: `${slug || "itinerary"}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(element)
        .save();
      toast.success("PDF downloaded");
    } catch {
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const itineraryMarkdown =
    state.payload?.itinerary || state.payload?.answer || "";
  const parsedItinerary = React.useMemo(
    () => parseItinerary(itineraryMarkdown),
    [itineraryMarkdown]
  );

  // Header summary pill e.g. "Tokyo, 5 days"
  const tripSummaryPill = React.useMemo(() => {
    const dest = state.constraints.destination?.trim();
    const dur = state.constraints.duration?.trim();
    if (dest && dur) return `${dest}, ${dur}`;
    if (dest) return dest;
    if (state.userQuery.trim()) {
      return state.userQuery.trim().length > 28
        ? `${state.userQuery.trim().slice(0, 28)}…`
        : state.userQuery.trim();
    }
    return undefined;
  }, [state.constraints.destination, state.constraints.duration, state.userQuery]);

  // Meta line for Review / Final e.g. "Tokyo · 5 days · about $2,400"
  const tripMetaLine = React.useMemo(() => {
    const parts = [
      state.constraints.destination,
      state.constraints.duration ||
        (parsedItinerary.days.length > 0
          ? `${parsedItinerary.days.length} days`
          : ""),
      state.constraints.budget ? `about ${state.constraints.budget}` : "",
    ]
      .map((s) => (s || "").trim())
      .filter(Boolean);
    return parts.join(" · ");
  }, [
    state.constraints.destination,
    state.constraints.duration,
    state.constraints.budget,
    parsedItinerary.days.length,
  ]);

  const doneStepsCount = React.useMemo(() => {
    return Object.values(state.steps).filter((s) => s.status === "done").length;
  }, [state.steps]);

  const isWorking =
    state.status === "submitting" ||
    state.status === "streaming" ||
    state.status === "revising";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--bg)] text-[var(--text)]">
      <AppHeader
        tripSummaryPill={tripSummaryPill}
        onNewTrip={handleNewTrip}
        showStatusPill={!tripSummaryPill}
      />

      {state.status === "idle" ? (
        <ItinerarySkeleton />
      ) : isWorking ? (
        <main className="mx-auto w-full max-w-[var(--container-app)] flex-1 px-4 pt-4 pb-16 sm:px-6 sm:pt-8">
          <div className="mb-8">
            <p className="label mb-2">
              {state.status === "revising"
                ? "REVISING ITINERARY"
                : "AGENTS AT WORK"}
            </p>
            <h1 className="h1 text-[var(--text)]">
              {state.status === "revising"
                ? "Updating your plan."
                : "Your team is on it."}
            </h1>
            <p className="mt-2 text-base text-[var(--muted)]">
              {formatTraceTimestamp(state.elapsedSeconds)} elapsed.{" "}
              {doneStepsCount} of 6 steps done.
            </p>
          </div>

          <TripBrief constraints={state.constraints} className="mb-6" />

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <AgentRail
              steps={state.steps}
              isRevising={state.status === "revising"}
            />

            <div className="space-y-3 lg:sticky lg:top-8 lg:self-start">
              <TracePanel
                traces={state.traces}
                status="streaming"
                collapsibleOnMobile
              />
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={handleNewTrip}
                className="w-full"
              >
                Cancel trip
              </Button>
            </div>
          </div>
        </main>
      ) : state.status === "blocked" ? (
        <main className="mx-auto flex w-full max-w-[var(--container-app)] flex-1 items-center px-4 py-12 sm:px-6">
          <BlockedState
            reason={
              state.guardrailReason ||
              state.payload?.guardrail_reason ||
              state.payload?.answer ||
              ""
            }
            onSelectExample={(example) =>
              router.push(`/app?q=${encodeURIComponent(example)}`)
            }
            onNewTrip={handleNewTrip}
          />
        </main>
      ) : state.status === "error" ? (
        <main className="mx-auto flex w-full max-w-[var(--container-app)] flex-1 items-center px-4 py-12 sm:px-6">
          <ErrorState
            message={
              state.error ||
              "We ran into an issue while generating this itinerary."
            }
            onRetry={() => window.location.reload()}
            onNewTrip={handleNewTrip}
          />
        </main>
      ) : state.status === "awaiting_approval" && state.payload ? (
        <>
          <main className="mx-auto w-full max-w-[var(--container-app)] flex-1 px-4 pt-4 pb-28 sm:px-6 sm:pt-8 lg:pb-16">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
              <h1 className="h1 text-[var(--text)]">Draft itinerary</h1>
              {tripMetaLine ? (
                <p className="text-sm text-[var(--muted)]">{tripMetaLine}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <ItineraryView parsed={parsedItinerary} />
                <InsightsAccordion payload={state.payload} />
              </div>

              <div className="hidden lg:block lg:sticky lg:top-8 lg:self-start">
                <ReviewPanel
                  dayCount={parsedItinerary.days.length}
                  onApprove={() => void handleApprove()}
                  onRevise={(feedback) => void handleRevise(feedback)}
                  isSubmitting={submittingReview}
                  submittingAction={submittingAction}
                />
              </div>
            </div>
          </main>

          <StickyActionBar
            dayCount={parsedItinerary.days.length}
            onApprove={() => void handleApprove()}
            onRevise={(feedback) => void handleRevise(feedback)}
            isSubmitting={submittingReview}
            submittingAction={submittingAction}
          />
        </>
      ) : state.payload ? (
        <main className="mx-auto w-full max-w-[var(--container-app)] flex-1 px-4 pt-4 pb-16 sm:px-6 sm:pt-8">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="h1 text-[var(--text)]">
              {state.constraints.destination
                ? `Your ${state.constraints.destination} itinerary`
                : "Approved itinerary"}
            </h1>
            {tripMetaLine ? (
              <p className="text-sm text-[var(--muted)]">{tripMetaLine}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <ItineraryView parsed={parsedItinerary} />
              <InsightsAccordion payload={state.payload} />
            </div>

            <div className="no-print lg:sticky lg:top-8 lg:self-start">
              <FinalActions
                markdown={itineraryMarkdown}
                destination={state.constraints.destination}
                onDownloadPdf={handleDownloadPdf}
                onNewTrip={handleNewTrip}
                isExportingPdf={isExportingPdf}
              />
            </div>
          </div>

          {/* Offscreen light-paper sheet for html2pdf.js export */}
          <div
            aria-hidden="true"
            className="fixed left-[-9999px] top-0 w-[780px] overflow-hidden"
          >
            <PdfSheet
              ref={pdfRef}
              parsed={parsedItinerary}
              constraints={state.constraints}
              payload={state.payload}
            />
          </div>
        </main>
      ) : (
        <ItinerarySkeleton />
      )}
    </div>
  );
}
