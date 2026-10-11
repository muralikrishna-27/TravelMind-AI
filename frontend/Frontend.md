# TravelMind AI — Frontend Summary & Production Deployment Guide

## 1. Overview

The **TravelMind AI Frontend** (`frontend/`) is a production-ready **Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS v4** web application that powers the multi-agent AI travel planner experience.

It communicates with the Python **FastAPI + LangGraph + Model Context Protocol (MCP)** backend through:
- **Next.js API Rewrites (`next.config.ts`):** Proxying `/api/travel`, `/api/travel/approve`, `/api/travel/:threadId`, and `/api/health` to `BACKEND_URL`.
- **Dedicated Node.js SSE Route Handler (`app/api/travel/[threadId]/events/route.ts`):** Streaming real-time multi-agent tool calls, steps, and human-in-the-loop interrupts with zero proxy buffering (`maxDuration = 60` on Vercel) and an automatic snapshot polling fallback.

---

## 2. Tech Stack

| Layer | Technology | Version / Notes |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router, Turbopack) | `16.4.0` |
| **UI Runtime** | React & React DOM | `19.3.0` |
| **Language** | TypeScript (`strict: true`) | `^5` |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/postcss`) | CSS custom properties + `@theme inline` |
| **Theme Engine** | `next-themes` (`attribute="data-theme"`) | Deep green-tinted Dark (`/` default) & Warm Stone Light (`/app` system default) |
| **UI Primitives** | Radix UI (`Accordion`, `Dialog`, `Tabs`, `Tooltip`, `Slot`) | Accessible keyboard & ARIA primitives |
| **Validation** | Zod | `^4.6.5` runtime schema validation for all API & SSE payloads |
| **Markdown** | `react-markdown` + `remark-gfm` + `rehype-sanitize` | XSS-safe rendering for agent outputs |
| **PDF Export** | `html2pdf.js` | Light-mode print sheet export (`<PdfSheet />`) |
| **Testing** | Vitest (`jsdom`) + Playwright + `@axe-core/playwright` | Unit tests + E2E & WCAG AA accessibility tests |
| **Package Manager** | `pnpm` | `pnpm@10.15.1` |

---

## 3. Design System & Theme Tokens (`app/globals.css`)

All UI surfaces, borders, and typography strictly consume semantic CSS custom properties—no hard-coded hex values or neutral pure blacks (`#000` / `#0a0a0a`) are used in components.

### Color Tokens

| Token | Light (`:root`) | Dark (`:root[data-theme="dark"]`) | Purpose |
| :--- | :--- | :--- | :--- |
| `--bg` | `#fafaf9` | `#0b120e` | Page background (deep green-tinted dark) |
| `--surface` | `#ffffff` | `#111a15` | Card & elevated surface |
| `--surface-2` | `#f5f5f4` | `#18231d` | Secondary surface, chips, active tabs |
| `--border` | `#e7e5e4` | `#22302a` | Hairline border (`1px`) |
| `--border-strong` | `#d6d3d1` | `#34443b` | Hover / focus-within emphasized border |
| `--text` | `#1c1917` | `#f4f7f5` | Primary ink |
| `--text-2` | `#44403c` | `#d2dad5` | Secondary body copy |
| `--muted` | `#78716c` | `#9aa8a0` | Labels, metadata, timestamps (≥ 4.5:1 contrast) |
| `--primary-bg` / `--primary-fg` | `#1c1917` / `#ffffff` | `#f4f7f5` / `#0b120e` | Primary CTA button |
| `--live` / `--live-soft` | `#16a34a` / `rgba(22,163,74,0.12)` | `#4ade80` / `rgba(74,222,128,0.12)` | Active agent & live status |
| `--warn-bg` / `--warn-border` / `--warn-fg` | `#fffbeb` / `#fde68a` / `#92400e` | `#2a2110` / `#5c4513` / `#fcd34d` | Human-in-the-loop review & guardrail states |
| `--danger-bg` / `--danger-fg` | `#fef2f2` / `#b91c1c` | `#2a1212` / `#fca5a5` | Error banner & form validation |
| `--trace-bg` / `--trace-fg` | `#1c1917` / `#d6d3d1` | `#09100c` / `#d2dad5` | Live terminal trace panel |
| `--glow` | `rgba(22, 163, 74, 0.1)` | `#16301f` | Top radial hero glow blending into `--bg` |

### Typography (`app/fonts.ts`)
Self-hosted via `next/font/google`:
- **Editorial Serif (`--font-serif`):** `Instrument Serif` — used for `.display`, `.h1`, and `.h2` headlines.
- **UI Sans (`--font-sans`):** `Geist` — used for body copy, buttons, `.h3` card titles, and `.label` uppercase eyebrows.
- **Monospace (`--font-mono`):** `Geist Mono` — used for `.mono` live trace logs, timestamps, and tabular cost/time values.

---

## 4. Routes & User Flows

| Route | Screen | Description |
| :--- | :--- | :--- |
| `/` | **Marketing Landing Page** | Centered mobile/desktop `NavPill`, editorial `Hero` with `PromptPill`, monochrome `TechLogoStrip` ("Built on" LangGraph, Groq, Tavily, AviationStack, OpenWeather), seamless infinite-scrolling 8-card `GalleryScroller`, `ControlCards`, 6-specialist `AgentGrid` with theme-aware WebP/PNG background artwork, `CtaPanel`, and `Footer`. |
| `/app` | **Trip Planner** | `AppHeader` (with backend health `StatusPill`), `PromptCard` (`Ctrl/Cmd + Enter` shortcut), 4 instant `PresetChips`, and `RecentTrips` stored in `localStorage` (`tm_threads_v1`, max 10). |
| `/app/trip/[threadId]` | **1. Agents at Work** | 2-column live workspace (`AgentRail` with sequential & parallel specialist progress + `TripBrief` on the left; `TracePanel` live terminal + `ItinerarySkeleton` on the right). |
| `/app/trip/[threadId]` | **2. Human-in-the-Loop Review** | Parsed day-by-day `ItineraryView` (`DayTabs` + `ItineraryRow` timeline + trip summary card), `InsightsAccordion` (Flights, Hotels, Weather, Budget markdown cards), `ReviewPanel` (selective day revision chips + feedback textarea + Approve / Request changes), and mobile `StickyActionBar`. |
| `/app/trip/[threadId]` | **3. Final Approved Plan** | Approved badge, `FinalActions` (`Copy markdown`, `Download PDF` via light-mode `PdfSheet`, `New trip`), full day-by-day itinerary, and collapsible specialist insights. |
| `/styleguide` | **Component Gallery (Dev Only)** | Visual kitchen-sink verifying all tokens, typography, logos, and states in light and dark themes (returns `notFound()` in production). |

---

## 5. Directory Structure

```text
frontend/
├── app/
│   ├── (marketing)/
│   │   ├── layout.tsx                        # Marketing shell
│   │   └── page.tsx                          # Landing page (/) with top radial --glow
│   ├── (app)/app/
│   │   ├── layout.tsx                        # Planner & workspace shell
│   │   ├── page.tsx                          # Trip prompt & recent trips (/app)
│   │   └── trip/[threadId]/page.tsx          # Live streaming, HITL review & final plan
│   ├── (dev)/styleguide/page.tsx             # Dev-only design system showcase
│   ├── api/travel/[threadId]/events/route.ts # Node.js SSE pass-through proxy (maxDuration=60)
│   ├── fonts.ts                              # Geist, Geist Mono, Instrument Serif
│   ├── globals.css                           # Theme tokens, typography, .gallery-mask, .agent-card-bg
│   └── layout.tsx                            # Root HTML layout & ThemeProvider
├── components/
│   ├── agents/                               # AgentNode, AgentGroup, AgentRail, TripBrief, TracePanel
│   ├── brand/                                # Logo, ThemeProvider, ThemeToggle, StatusPill, AppHeader
│   ├── final/                                # FinalActions, PdfSheet
│   ├── landing/                              # NavPill, Hero, PromptPill, TechLogoStrip, GalleryScroller,
│   │   │                                     # GalleryCard, gallery-cards.ts, ControlCards, AgentGrid, CtaPanel, Footer
│   │   └── logos/                            # Official monochrome SVG wordmarks/logos
│   ├── planner/                              # PromptCard, PresetChips, RecentTrips
│   ├── review/                               # SafeMarkdown, DayTabs, ItineraryRow, ItineraryView,
│   │                                         # InsightsAccordion, ReviewPanel, StickyActionBar
│   ├── states/                               # Skeletons, OfflineBanner, EmptyState, ErrorState, BlockedState
│   └── ui/                                   # Button, Input, Textarea, Card, Badge, Chip, Tabs, Accordion, etc.
├── hooks/
│   ├── use-health.ts                         # Polls /api/health every 30s
│   ├── use-local-storage.ts                  # SSR-safe localStorage hook
│   ├── use-reduced-motion.ts                 # Reduced motion hook for app workspace
│   ├── use-trip-stream.ts                    # EventSource SSE + exponential backoff + polling fallback
│   ├── useAutoScroll.ts                      # Seamless rAF infinite loop scroller with hover/focus/offscreen pause
│   ├── useDragScroll.ts                      # Pointer drag-to-scroll with click suppression after drag
│   └── useReducedMotion.ts                   # Reduced motion hook for landing gallery
├── lib/
│   ├── api.ts                                # Zod-validated API client & friendly error translator
│   ├── parse-itinerary.ts                    # Parses ### Day N markdown tables & summary sections
│   ├── schemas.ts                            # Zod schemas for API payloads, constraints, and SSE frames
│   ├── threads.ts                            # Recent trips persistence (tm_threads_v1)
│   ├── trip-machine.ts                       # Deterministic tripReducer state machine
│   └── utils.ts                              # cn() class merger
├── public/
│   └── agent-card-backgrounds/               # 12 PNG + 12 WebP (light/dark) specialist card illustrations
├── tests/
│   ├── e2e/travelmind.spec.ts                # Playwright responsive, axe accessibility & full-flow E2E suite
│   └── unit/                                 # Vitest unit tests (parse-itinerary, trip-machine)
├── .env.example                              # Environment variable template
├── .vercelignore                             # Excludes test/cache artifacts from Vercel uploads
├── next.config.ts                            # Rewrites, security headers (CSP/HSTS) & asset cache rules
├── package.json                              # Scripts & dependencies
└── vercel.json                               # Vercel production build & function config
```

---

## 6. Production Deployment on Vercel

The `frontend/` directory is pre-configured with [`vercel.json`](./vercel.json), [`.vercelignore`](./.vercelignore), and [`next.config.ts`](./next.config.ts) for zero-friction deployment on Vercel.

### Step 1: Import Project into Vercel
1. Open the [Vercel Dashboard](https://vercel.com/new) and import the `TravelMind-AI` repository.
2. Set **Root Directory** to `frontend`.
3. Vercel will automatically detect `vercel.json`:
   - **Framework Preset:** `Next.js`
   - **Install Command:** `pnpm install --frozen-lockfile`
   - **Build Command:** `pnpm run build`

### Step 2: Configure Environment Variables
In **Vercel Project Settings → Environment Variables**, add:

| Variable | Value | Environments |
| :--- | :--- | :--- |
| `BACKEND_URL` | `https://your-fastapi-backend.example.com` *(no trailing slash)* | Production, Preview, Development |

> **How routing works in production:** All browser requests go to same-origin `/api/*` paths. `next.config.ts` rewrites REST calls (`/api/travel`, `/api/travel/approve`, `/api/travel/:threadId`, `/api/health`) to `${BACKEND_URL}`, while `app/api/travel/[threadId]/events/route.ts` proxies the Server-Sent Events stream with `maxDuration = 60`. If an SSE connection ever times out on serverless infrastructure, `useTripStream` automatically falls back to `GET /api/travel/:threadId` snapshot polling every 2 seconds without losing state.

### Step 3: Local Production Verification
Before deploying or pushing to `main`, you can verify the production build locally from `frontend/`:

```bash
# 1. Type-check and lint
pnpm run typecheck
pnpm run lint

# 2. Run unit tests (Vitest)
pnpm run test

# 3. Build for production
pnpm run build

# 4. Start the production server locally
pnpm run start
```
