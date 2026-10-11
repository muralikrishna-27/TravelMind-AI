import type { TripStatus } from "@/lib/schemas";

export interface StoredThreadItem {
  id: string;
  title: string;
  subtitle?: string;
  status: TripStatus;
  updatedAt: number;
}

export const THREADS_STORAGE_KEY = "tm_threads_v1";
const MAX_THREADS = 10;

export function readStoredThreads(): StoredThreadItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(THREADS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is StoredThreadItem =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as StoredThreadItem).id === "string" &&
          typeof (item as StoredThreadItem).title === "string"
      )
      .slice(0, MAX_THREADS);
  } catch {
    return [];
  }
}

export function upsertStoredThread(item: StoredThreadItem): StoredThreadItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const existing = readStoredThreads().filter((t) => t.id !== item.id);
    const updated = [item, ...existing].slice(0, MAX_THREADS);
    window.localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearLegacyThreadStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem("travel_thread_id");
  } catch {
    // Ignore storage access errors in restricted browsing modes
  }
}

export function deriveThreadTitle(
  query: string,
  destination?: string,
  duration?: string
): string {
  const cleanDest = (destination || "").trim();
  const cleanDur = (duration || "").trim();
  if (cleanDest && cleanDur) {
    return `${cleanDest}, ${cleanDur}`;
  }
  if (cleanDest) {
    return cleanDest;
  }
  const trimmed = query.trim();
  if (!trimmed) return "Untitled trip";
  return trimmed.length > 36 ? `${trimmed.slice(0, 36).trim()}…` : trimmed;
}
