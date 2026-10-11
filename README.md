# TravelMind-AI

TravelMind-AI is a multi-agent travel planner powered by **LangGraph**, **FastAPI**, **MCP (Model Context Protocol)**, and a **Next.js (App Router) + React + TypeScript** frontend.

Describe your trip in plain English—five specialist agents (**Flights**, **Hotels**, **Weather**, **Budget**, and **Itinerary**) research it live, stream their execution trace in real time, and pause at a **Human-in-the-Loop (HITL)** review gate so you can revise specific days or approve the final plan.

## Live Demo

https://travelmind-ai-x407.onrender.com

## Features

- **Minimal, Editorial UI (`frontend/`):** Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS v4 with light and dark themes (`next-themes`), self-hosted `Geist` / `Instrument Serif` / `Geist Mono` fonts, and full mobile responsiveness (`390px` to `1440px+`).
- **Live Agents-at-Work Experience:** Real-time Server-Sent Events (`GET /api/travel/{thread_id}/events`) + snapshot recovery (`GET /api/travel/{thread_id}`) driving the `<AgentRail />` and monospace `<TracePanel />`.
- **Structured Day-by-Day Review & Approval:** Interactive day tabs (`Day 1..N` + `Summary`), time/activity/cost rows, collapsible **Agent Insights** (`Flights`, `Hotels`, `Weather`, `Budget`), and targeted day revisions.
- **Safe Markdown & PDF Export:** All LLM and tool outputs are sanitized via `react-markdown` + `remark-gfm` + `rehype-sanitize`, with one-click Markdown copy and light-paper PDF export (`html2pdf.js`).
- **Multi-Agent Backend (`app.py`, `backend.py`, `mcp_client.py`):** LangGraph state machine with input guardrails, supervisor routing, AviationStack MCP, Tavily MCP, custom OpenWeather MCP server, and PostgreSQL checkpoint persistence.

## Project Structure

```text
TravelMind-AI/
├── frontend/                     # Next.js (App Router) + React + TypeScript UI
│   ├── app/                      # (marketing) landing page, (app)/app planner & trip workspace, SSE route
│   ├── components/               # ui/, brand/, landing/, planner/, agents/, review/, final/, states/
│   ├── hooks/                    # useTripStream, useHealth, useLocalStorage, useReducedMotion
│   ├── lib/                      # Zod schemas, tripReducer state machine, itinerary parser, API client
│   ├── tests/                    # Vitest unit tests + Playwright E2E & axe accessibility tests
│   └── UI_NOTES.md               # Frontend design system & architecture documentation
├── design-reference/             # Approved reference screenshots & after-refactor captures
├── app.py                        # FastAPI service (/api/travel, /api/travel/{id}, /events, /approve, /health)
├── backend.py                    # LangGraph multi-agent workflow, PostgresSaver checkpointer & SSE streamer
├── mcp_client.py                 # MultiServerMCPClient (Tavily, AviationStack, OpenWeather)
├── custom_weather_mcp_server.py  # Custom OpenWeather MCP server
├── requirements.txt              # Python dependencies
└── Dockerfile
```

## Environment Variables

### Backend (`.env` in repository root)

```env
GROQ_API_KEY=your_groq_api_key
TAVILY_API_KEY=your_tavily_api_key
AVIATION_STACK_API_KEY=your_aviationstack_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
DATABASE_URL=your_postgresql_connection_string

LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=your_langsmith_api_key
LANGSMITH_PROJECT=TravelMind-AI
```

### Frontend (`frontend/.env.local`)

```env
BACKEND_URL=http://127.0.0.1:8000
```

## Run Locally

### 1. Start the Python FastAPI Backend (`:8000`)

```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
python app.py
```

### 2. Start the Next.js Frontend (`:3000`)

```bash
cd frontend
pnpm install
pnpm dev
```

Open `http://localhost:3000` for the marketing landing page or `http://localhost:3000/app` for the trip planner.

## Testing & Verification

```bash
cd frontend
pnpm typecheck     # next typegen && tsc --noEmit
pnpm lint          # ESLint
pnpm test          # Vitest unit tests (parser, state machine, XSS sanitization)
pnpm test:e2e      # Playwright E2E + axe WCAG accessibility audit
pnpm build         # Production Next.js build
```
