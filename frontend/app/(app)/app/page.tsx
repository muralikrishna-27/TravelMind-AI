"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/brand/app-header";
import { Badge } from "@/components/ui/badge";
import { PromptCard } from "@/components/planner/prompt-card";
import { PresetChips } from "@/components/planner/preset-chips";
import { RecentTrips } from "@/components/planner/recent-trips";
import { startTripRequest, FriendlyApiError } from "@/lib/api";
import {
  clearLegacyThreadStorage,
  deriveThreadTitle,
  readStoredThreads,
  upsertStoredThread,
  type StoredThreadItem,
} from "@/lib/threads";

const emptySubscribe = () => () => {};

function PlannerForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = React.useState(initialQuery);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isClient = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [threadsOverride, setThreadsOverride] = React.useState<
    StoredThreadItem[] | null
  >(null);
  const threads = React.useMemo(
    () => threadsOverride ?? (isClient ? readStoredThreads() : []),
    [threadsOverride, isClient]
  );

  React.useEffect(() => {
    clearLegacyThreadStorage();
  }, []);

  const handleReset = () => {
    clearLegacyThreadStorage();
    setPrompt("");
    setError(null);
    setLoading(false);
    router.replace("/app");
  };

  const submitTrip = async (rawMessage: string) => {
    const trimmed = rawMessage.trim();
    if (!trimmed) {
      setError("Describe where you want to go and for how many days.");
      return;
    }

    setError(null);
    setLoading(true);
    clearLegacyThreadStorage();

    try {
      const result = await startTripRequest(trimmed, null);
      const updated = upsertStoredThread({
        id: result.threadId,
        title: deriveThreadTitle(
          trimmed,
          result.immediatePayload?.trip_constraints?.destination,
          result.immediatePayload?.trip_constraints?.duration
        ),
        status: result.immediatePayload
          ? result.immediatePayload.guardrail_allowed === false
            ? "blocked"
            : result.immediatePayload.requires_approval
              ? "awaiting_approval"
              : "approved"
          : "streaming",
        updatedAt: Date.now(),
      });
      setThreadsOverride(updated);

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          `tm_query_${result.threadId}`,
          trimmed
        );
        if (result.immediatePayload) {
          window.sessionStorage.setItem(
            `tm_payload_${result.threadId}`,
            JSON.stringify(result.immediatePayload)
          );
        }
      }

      router.push(`/app/trip/${encodeURIComponent(result.threadId)}`);
    } catch (err) {
      const message =
        err instanceof FriendlyApiError
          ? err.message
          : "Unable to start planning right now. Please try again.";
      setError(message);
      setLoading(false);
    }
  };

  const handlePresetSelect = (presetPrompt: string) => {
    setPrompt(presetPrompt);
    setError(null);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--bg)] text-[var(--text)]">
      <AppHeader onNewTrip={handleReset} showStatusPill />

      <main className="mx-auto flex w-full max-w-[var(--container-app)] flex-1 flex-col items-center justify-center px-4 pt-8 pb-20 text-center sm:px-6 sm:pt-12">
        <Badge variant="default" className="mb-6 px-3.5 py-1 text-xs font-medium">
          Multi-agent trip planner
        </Badge>

        <h1 className="h1 max-w-[16ch] text-[var(--text)]">Where to next?</h1>

        <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-[var(--muted)]">
          Describe the trip in plain English. Five specialists research it in
          parallel, then pause for your approval.
        </p>

        <div className="mt-8 w-full">
          <PromptCard
            value={prompt}
            onChange={(val) => {
              setPrompt(val);
              if (error) setError(null);
            }}
            onSubmit={() => void submitTrip(prompt)}
            loading={loading}
            error={error}
          />
        </div>

        <div className="mt-5 w-full max-w-[680px]">
          <PresetChips onSelect={handlePresetSelect} disabled={loading} />
        </div>

        <div className="mt-14 w-full">
          <RecentTrips threads={threads} />
        </div>
      </main>
    </div>
  );
}

function PlannerSearchParamsBridge() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  return <PlannerForm key={initialQuery} initialQuery={initialQuery} />;
}

export default function PlannerPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--text)]" />
      }
    >
      <PlannerSearchParamsBridge />
    </React.Suspense>
  );
}
