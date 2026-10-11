export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="flex min-h-[100dvh] items-center justify-center bg-[var(--bg)] text-[var(--muted)]"
    >
      <div className="flex items-center gap-2.5 text-sm">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-[var(--r-pill)] bg-[var(--live)] animate-pulse"
        />
        <span>Loading TravelMind…</span>
      </div>
    </div>
  );
}
