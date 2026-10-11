# TravelMind AI — Frontend Architecture & UI Notes

## 1. Overview

The TravelMind AI frontend is a **Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS v4** application located in `frontend/`. It replaces the legacy Jinja2 `templates/` and `static/` assets while communicating with the Python FastAPI + LangGraph + MCP backend via `/api/*` rewrites and a dedicated Node.js Server-Sent Events (SSE) pass-through route handler.

---

## 2. Design System & Tokens

All visual tokens are defined as CSS custom properties in `app/globals.css` for both `:root` (Light) and `:root[data-theme="dark"]` (Dark), and mapped into Tailwind CSS v4 via `@theme inline`:

| Token | Light | Dark | Role |
| :--- | :--- | :--- | :--- |
| `--bg` | `#fafaf9` | `#0b120e` | Page background |
| `--surface` | `#ffffff` | `#111a15` | Card / elevated surface |
| `--surface-2` | `#f5f5f4` | `#18231d` | Muted surface / chips / tabs |
| `--border` | `#e7e5e4` | `#22302a` | Hairline border |
| `--border-strong` | `#d6d3d1` | `#34443b` | Emphasized border |
| `--text` | `#1c1917` | `#f4f7f5` | Primary ink |
| `--text-2` | `#44403c` | `#d2dad5` | Secondary body ink |
| `--muted` | `#78716c` | `#9aa8a0` | Labels, metadata, timestamps |
| `--primary-bg` / `--primary-fg` | `#1c1917` / `#ffffff` | `#f4f7f5` / `#0b120e` | Primary CTA contrast |
| `--live` / `--live-soft` | `#16a34a` | `#4ade80` | Live streaming & approved status |
| `--warn-bg` / `--warn-border` / `--warn-fg` | `#fffbeb` / `#fde68a` / `#92400e` | `#2a2110` / `#5c4513` / `#fcd34d` | HITL review / guardrail attention |
| `--danger-bg` / `--danger-fg` | `#fef2f2` / `#b91c1c` | `#2a1212` / `#fca5a5` | Error state |
| `--trace-bg` / `--trace-fg` | `#1c1917` / `#d6d3d1` | `#09100c` / `#d2dad5` | Live trace terminal panel |
| `--glow` | `rgba(22, 163, 74, 0.1)` | `#16301f` | Top radial hero glow |

### Typography (`app/fonts.ts`)
Self-hosted via `next/font/google`:
- **Sans (`--font-sans`):** `Geist` — UI chrome, body copy, H3 headings, uppercase `.label` eyebrows.
- **Serif (`--font-serif`):** `Instrument Serif` — editorial `.display`, `.h1`, and `.h2` headings.
- **Mono (`--font-mono`):** `Geist Mono` — live trace lines, time slots, and cost figures.

### Theme Switching (`components/brand/theme-provider.tsx` & `theme-toggle.tsx`)
- Powered by `next-themes` with `attribute="data-theme"` and `storageKey="tm_theme"`.
- Landing page (`/`) defaults to `"dark"` for first-time visitors; `/app` defaults to `"system"`.
- `<ThemeToggle />` uses `React.useSyncExternalStore` to avoid hydration mismatches without triggering cascading `useEffect` renders.

---

## 3. Route Structure & Component Architecture

```text
frontend/
├─ app/
│  ├─ (marketing)/
│  │  ├─ layout.tsx
│  │  └─ page.tsx                          # Landing page (/)
│  ├─ (app)/app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx                          # Planner (/app)
│  │  └─ trip/[threadId]/page.tsx          # Agents at Work, Review & Final Plan
│  ├─ (dev)/styleguide/page.tsx            # Dev-only component gallery (404 in prod)
│  ├─ api/travel/[threadId]/events/route.ts# Node.js SSE pass-through proxy
│  ├─ fonts.ts
│  ├─ globals.css
│  └─ layout.tsx
├─ components/
│  ├─ ui/                                  # Token-styled Radix/shadcn primitives
│  ├─ brand/                               # Logo, ThemeProvider, ThemeToggle, StatusPill, AppHeader
│  ├─ landing/                             # NavPill, Hero, PromptPill, GalleryScroller, ControlCards, AgentGrid, CtaPanel, Footer
│  ├─ planner/                             # PromptCard, PresetChips, RecentTrips
│  ├─ agents/                              # AgentNode, AgentGroup, AgentRail, TripBrief, TracePanel
│  ├─ review/                              # SafeMarkdown, DayTabs, ItineraryRow, ItineraryView, InsightsAccordion, ReviewPanel, StickyActionBar
│  ├─ final/                               # FinalActions, PdfSheet
│  └─ states/                              # Skeletons, OfflineBanner, EmptyState, ErrorState, BlockedState
├─ hooks/
│  ├─ use-health.ts                        # Polls /api/health
│  ├─ use-local-storage.ts                 # SSR-safe localStorage hook
│  ├─ use-reduced-motion.ts                # Respects prefers-reduced-motion
│  └─ use-trip-stream.ts                   # EventSource SSE + automatic polling fallback
└─ lib/
   ├─ api.ts                               # Zod-validated API client & friendly error mapper
   ├─ parse-itinerary.ts                   # Parses ### Day N markdown tables & summary footers
   ├─ schemas.ts                           # Zod schemas for payloads, constraints, and SSE events
   ├─ threads.ts                           # Recent trips manager (tm_threads_v1, max 10)
   └─ trip-machine.ts                      # Pure tripReducer state machine
```

---

## 4. Audit Issues Resolved

1. **XSS Elimination (`C-1`):** Replaced raw `marked.parse` + `innerHTML` with `<SafeMarkdown />` (`react-markdown` + `remark-gfm` + `rehype-sanitize`) and strict Content-Security-Policy headers in `next.config.ts`.
2. **Specialist Outputs Surfaced (`H-2`):** `flight_results`, `hotel_results`, `weather_results`, and `budget_results` are rendered in `<InsightsAccordion />` under the itinerary and `trip_constraints` are shown in `<TripBrief />` and the header summary pill.
3. **Real-Time Multi-Agent Progress (`H-5`):** Added non-blocking background execution, `GET /api/travel/{thread_id}` snapshots, and `GET /api/travel/{thread_id}/events` Server-Sent Events streaming to power `<AgentRail />` and `<TracePanel />`.
4. **Fresh Thread Reset (`M-2`):** Starting a new trip from `/app` or clicking `"New trip"` always clears legacy `travel_thread_id` and creates a fresh `thread_id`, while storing up to 10 recent trips in `tm_threads_v1`.
5. **AviationStack & Final-Day Revision Fixes (`C-2`, `H-4`):** Fixed the `"Aviationstack MCP"` server lookup in `mcp_client.py` and updated `DAY_PATTERN` in `backend.py` so revising the final day preserves the trip summary footer.
6. **PDF Export Title & Theme (`M-5`):** `<PdfSheet />` renders on a dedicated light-paper surface (`data-theme="light"`) with a visible destination title and metadata header.
