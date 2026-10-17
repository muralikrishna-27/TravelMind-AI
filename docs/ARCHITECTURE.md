# TravelMind AI — System Architecture & Multi-Agent Design

This document details the architectural design, agent state machine, data flows, and infrastructure behind **TravelMind AI**.

---

## 1. High-Level Architecture

TravelMind AI is structured as a decoupled, modern multi-agent system composed of three primary tiers:

```mermaid
flowchart TD
    subgraph Client ["Client Tier (Next.js 16 + React 19)"]
        UI["App Router UI (/app, /app/trip/[threadId])"]
        SM["Deterministic State Machine (tripReducer)"]
        HOOK["useTripStream (SSE Client + Polling Fallback)"]
        SAN["SafeMarkdown (XSS Sanitizer)"]
        PDF["html2pdf.js (Light-Paper Print Sheet)"]
    end

    subgraph Server ["API & Orchestration Tier (FastAPI + LangGraph)"]
        API["FastAPI Endpoints (/api/travel, /events, /approve, /health)"]
        BUS["In-Memory Event Bus (_SESSIONS + Cursor SSE)"]
        WORKER["Background Daemon Stream Workers"]
        LG["LangGraph State Graph"]
    end

    subgraph Agents ["Multi-Agent Execution Engine"]
        GR["Input Guardrail"]
        SUP["Supervisor Router"]
        FL["Flight Specialist Agent"]
        HT["Hotel Specialist Agent"]
        WT["Weather Specialist Agent"]
        BG["Budget Specialist Agent"]
        IT["Itinerary Synthesizer Agent"]
        HITL["Human-in-the-Loop Review Gate"]
        FIN["Final Agent"]
    end

    subgraph Tools ["MCP & External Services"]
        TAV["Tavily Search MCP (HTTP)"]
        AVS["AviationStack MCP (stdio / uvx)"]
        OWM["Custom Weather FastMCP Server (stdio / Python)"]
        GROQ["Groq Cloud LLM (gpt-oss-120b & gpt-oss-20b)"]
        PG["PostgreSQL Checkpointer (PostgresSaver / MemorySaver)"]
    end

    UI --> HOOK
    HOOK -->|"GET /api/travel/{id}/events (SSE)"| API
    UI -->|"POST /api/travel (Trip Request)"| API
    UI -->|"POST /api/travel/approve (HITL Review)"| API
    API --> BUS
    API --> WORKER
    WORKER --> LG
    LG --> GR --> SUP
    SUP --> FL & HT & WT & BG
    FL & HT & WT & BG --> IT
    IT --> HITL
    HITL -->|"Revision Feedback"| IT
    HITL -->|"Approved"| FIN

    FL --> AVS
    HT --> TAV
    WT --> OWM
    SUP & IT & BG & FIN --> GROQ
    LG <--> PG
```

---

## 2. LangGraph State Machine

The core orchestration engine is built on **LangGraph**. The workflow state is tracked using `TravelState`, a structured `TypedDict` that records user queries, guardrail status, routing decisions, specialist findings, approval feedback, and execution traces.

### 2.1 State Definition (`TravelState`)

```python
class TravelState(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], operator.add]
    user_query: str

    # Guardrail and supervisor routing
    guardrail_allowed: bool
    guardrail_reason: str
    selected_agents: list[str]
    trip_constraints: dict[str, Any]
    supervisor_reasoning: str

    # Specialist agent findings
    flight_results: str
    hotel_results: str
    weather_results: str
    budget_results: str

    # Itinerary and Human-in-the-Loop review
    itinerary: str
    approval_request: str
    approved: bool
    human_feedback: str
    final_response: str

    # Execution telemetry
    llm_calls: int
```

### 2.2 Graph Topology & Routing

```mermaid
stateDiagram-v2
    [*] --> supervisor: START
    
    supervisor --> guardrail_blocked: guardrail_allowed == False
    supervisor --> flight_agent: selected_agents contains flight_agent
    supervisor --> hotel_agent: flight_agent not selected
    supervisor --> weather_agent: flights/hotels not selected
    supervisor --> budget_agent: flights/hotels/weather not selected
    supervisor --> itinerary_agent: only itinerary selected

    guardrail_blocked --> [*]: END

    flight_agent --> hotel_agent: Next selected agent
    flight_agent --> weather_agent: hotel_agent not selected
    flight_agent --> budget_agent: weather_agent not selected
    flight_agent --> itinerary_agent: only itinerary remains

    hotel_agent --> weather_agent: Next selected agent
    hotel_agent --> budget_agent: weather_agent not selected
    hotel_agent --> itinerary_agent: only itinerary remains

    weather_agent --> budget_agent: Next selected agent
    weather_agent --> itinerary_agent: budget_agent not selected

    budget_agent --> itinerary_agent: Proceed to itinerary synthesis

    itinerary_agent --> human_approval: Generates draft & pauses
    
    human_approval --> itinerary_agent: User requests changes (approved == False)
    human_approval --> final_agent: User approves plan (approved == True)

    final_agent --> [*]: END
```

---

## 3. Multi-Agent Specialist Breakdown

### 3.1 Input Guardrail (`guardrail_agent`)
- **Purpose:** Protects backend resources by screening user queries before any external API or specialist agent runs.
- **Rules:**
  1. **Relevance:** Must belong to travel planning (destinations, flights, accommodations, packing, budgets, activities). Off-topic queries or prompt injections are rejected.
  2. **Duration Cap:** Enforces a maximum trip duration of **7 days** (`MAX_TRIP_DAYS = 7`) to ensure reliable LLM completion within token limits.
  3. **Fail-Open Resilience:** If the guardrail LLM fails to return strict JSON, the request falls open to preserve usability.

### 3.2 Supervisor Agent (`supervisor_agent`)
- **Purpose:** Analyzes the user's travel request, extracts structured constraints, and dynamically routes tasks to required specialist agents.
- **Constraints Extracted:**
  - `destination`: Target city and country
  - `origin`: Departure airport/city (defaults to `DEFAULT_ORIGIN_IATA` if omitted)
  - `duration`: Number of days (1 to 7)
  - `budget`: Budget category (budget, mid-range, luxury) or exact monetary limit
  - `travel_style`: Leisure, adventure, cultural, family, romantic, solo
  - `special_preferences`: Dietary requirements, mobility needs, preferred activities
- **Dynamic Dependency Selection:**
  - If a user only asks about weather and hotels, `flight_agent` is skipped.
  - `itinerary_agent` is always mandatory to assemble the cohesive schedule.

### 3.3 Flight Specialist Agent (`flight_agent`)
- **Tools:**
  - `Aviationstack MCP`: Queries real-time airline flight schedules, routes, and airport data via stdio subprocess.
  - `Tavily Search MCP`: Fallback web research for route price averages, carrier options, and seasonal fare trends.
- **Output:** Formatted flight options with estimated airfares, departure/arrival hubs, and booking guidelines.

### 3.4 Hotel Specialist Agent (`hotel_agent`)
- **Tools:**
  - `Tavily Search MCP`: Live web discovery of boutique hotels, luxury resorts, and budget hostels.
- **Output:** Curated accommodations with neighborhood proximity, amenities, nightly rates, and traveler ratings.

### 3.5 Weather Specialist Agent (`weather_agent`)
- **Tools:**
  - `custom_weather_mcp_server.py`: Custom FastMCP server interfacing with OpenWeatherMap REST API over stdio transport.
- **Capabilities:**
  - `get_current_weather(city)`: Temperature (°C), feels-like, humidity (%), weather condition, and wind speed (m/s).
  - `get_forecast(city)`: 5 intervals of 3-hour forecasts with temperature trends and sky conditions.
- **Output:** Markdown tables summarizing immediate conditions and upcoming forecast for travel packing.

### 3.6 Budget Specialist Agent (`budget_agent`)
- **Purpose:** Compiles an itemized cost projection by synthesizing flight estimates, nightly hotel rates, daily food allowances, and local attraction fees against the user's budget constraint.
- **Output:** Expense tier breakdown and cost-saving recommendations.

### 3.7 Itinerary Synthesizer Agent (`itinerary_agent`)
- **Model:** `MAIN_MODEL` (`openai/gpt-oss-120b`).
- **Prompt Structure:**
  - Synthesizes all specialist outputs into strict Markdown format:
    ```markdown
    ### Day 1 – Arrival & Exploration
    | Time | Activity | Cost |
    |---|---|---|
    | 09:00 AM | Landing & Hotel Check-in | $50 (Taxi) |
    | 01:00 PM | Historic Center Walking Tour | Free |
    | 07:30 PM | Welcome Dinner at Local Bistro | $35 |

    ### Day 2 – Cultural Landmarks
    ...
    ### Trip Summary & Practical Tips
    - **Total Estimated Cost:** $1,250
    - **Transit Tips:** Purchase a 3-day Metro Pass ($18).
    ```
- **Selective Day Revisions:** When the user returns feedback from the HITL gate:
  - `day_selector_llm` identifies the exact days affected by the feedback.
  - `revision_llm` regenerates only the affected days.
  - `_merge_revised_days` surgically replaces the revised day sections while preserving untouched days and the trip summary footer.

### 3.8 Human-in-the-Loop (HITL) Review Gate (`human_approval_agent`)
- **Mechanism:** LangGraph `interrupt(...)`.
- **Workflow:**
  1. The graph pauses after `itinerary_agent` drafts the preliminary schedule.
  2. The state is saved into the checkpointer.
  3. The frontend displays the draft in `<ItineraryView />` with day tabs and specialist insights.
  4. The traveler can:
     - **Approve:** Proceeds to `final_agent` to lock in the trip.
     - **Request Changes:** Submits natural-language feedback (e.g. *"Make Day 3 focus on food tours and reduce Day 2 activity costs"*). The graph loops back to `itinerary_agent`.

### 3.9 Final Agent (`final_agent`)
- **Purpose:** Seals the approved itinerary, produces final travel notes, and marks the session status as `approved`.

---

## 4. State Persistence & Checkpointing

TravelMind AI supports dual checkpointing modes:

```mermaid
flowchart LR
    URL{"DATABASE_URL configured?"}
    URL -->|Yes| PG["PostgreSQL (PostgresSaver)"]
    URL -->|No / Failed| MEM["In-Memory (MemorySaver)"]
    PG -->|"Saves State Snapshots per thread_id"| GRAPH["LangGraph Compiled Graph"]
    MEM -->|"Saves State Snapshots per thread_id"| GRAPH
```

### PostgreSQL Checkpointer (`PostgresSaver`)
- Connected via `psycopg` (binary) with `dict_row` row factory and `autocommit=True`.
- Enforces `sslmode=require` for secure remote cloud hosting (Render, Supabase, Neon).
- Configured with `connect_timeout=10` to avoid hangs during initialization.
- Saves state transitions and interrupt payloads indexed by `thread_id`.

### Resilient Memory Fallback (`MemorySaver`)
- When `DATABASE_URL` is omitted (local development, testing) or if the remote database is unreachable, the system automatically falls back to `MemorySaver`.
- Ensures zero boot crashes, zero external dependencies required for quick testing.

---

## 5. Real-Time Streaming Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant FE as Next.js Frontend
    participant API as FastAPI Backend
    participant Worker as Background Stream Worker
    participant Graph as LangGraph Engine
    participant Bus as Event Bus (_SESSIONS)

    User->>FE: Submits "5-day trip to Tokyo on $2000"
    FE->>API: POST /api/travel {message, sync: false}
    API->>Bus: Create session (status: "planning")
    API->>Worker: Spawn daemon thread
    API-->>FE: Return {success: true, thread_id: "uuid"}
    FE->>FE: Redirect to /app/trip/[threadId]
    FE->>API: GET /api/travel/[threadId]/events (SSE)
    
    loop Stream Execution
        Worker->>Graph: Execute step (supervisor -> agents -> itinerary)
        Graph-->>Worker: Step event (node name, status)
        Worker->>Bus: Append event {"type": "step", "agent": "flight_agent"}
        Worker->>Bus: Append trace {"type": "trace", "line": "..."}
        Bus-->>API: SSE generator yields data
        API-->>FE: EventSource message received
        FE->>FE: Update AgentRail & TracePanel
    end

    Graph->>Worker: Interrupt at human_approval
    Worker->>Bus: Append {"type": "final", "payload": {...}}
    Bus-->>API: Yields interrupt event
    API-->>FE: Stream closes / status: awaiting_approval
    FE->>User: Displays Interactive Review & DayTabs
```

### Event Bus Specifications
1. **Thread Safety:** `_SESSIONS` dictionary is protected by `_SESSIONS_LOCK` (`threading.RLock`).
2. **Cursor Pagination:** SSE clients track an integer `cursor` counter. If a client disconnects and reconnects, pending events since the cursor are replayed immediately without data loss.
3. **Snapshot Recovery:** If the SSE stream terminates due to serverless infrastructure timeouts (e.g. Vercel 60s execution limit), `useTripStream` seamlessly falls back to polling `GET /api/travel/{thread_id}` every 2 seconds.
