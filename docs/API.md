# TravelMind AI — API Reference & Protocol Specification

This document provides the complete API specification for the **TravelMind AI** backend service.

---

## 1. Base URLs & Protocol Conventions

- **Local Development:** `http://127.0.0.1:8000`
- **Frontend Proxy:** Same-origin requests made to `/api/*` are proxied to the backend via `next.config.ts` rewrites.
- **Content Types:**
  - Standard endpoints: `application/json; charset=utf-8`
  - Event streaming: `text/event-stream; charset=utf-8`
- **CORS:** Controlled by `ALLOWED_ORIGINS` (defaults to `http://localhost:3000,http://127.0.0.1:3000`), with wildcard support for `*.vercel.app` preview deployments.

---

## 2. Endpoints Summary

| Method | Path | Description | Response Type |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` / `/api/health` | Service health & checkpointer telemetry | `application/json` |
| `POST` | `/api/travel` | Initiates trip planning session | `application/json` |
| `GET` | `/api/travel/{thread_id}` | Retrieves full snapshot of a trip session | `application/json` |
| `GET` | `/api/travel/{thread_id}/events` | Real-time Server-Sent Events (SSE) stream | `text/event-stream` |
| `POST` | `/api/travel/approve` | Submits Human-in-the-Loop approval or revision | `application/json` |

---

## 3. Endpoint Details

### 3.1 Health Check

```http
GET /health
GET /api/health
```

#### Response (`200 OK`)

```json
{
  "status": "ok",
  "message": "TravelMind AI API is running",
  "checkpointer": "postgres",
  "features": [
    "supervisor_agent",
    "input_guardrail",
    "human_in_the_loop",
    "sse_streaming"
  ]
}
```

- `checkpointer`: Either `"postgres"` (connected to PostgreSQL) or `"memory"` (in-memory `MemorySaver` fallback).

---

### 3.2 Start Trip Planning

```http
POST /api/travel
Content-Type: application/json
```

#### Request Body (`TravelRequest`)

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `message` | `string` | **Yes** | Travel request description in natural language (max 1,000 characters). |
| `thread_id` | `string` | No | Optional UUID to resume or isolate state. Generated automatically if omitted. |
| `sync` | `boolean` | No | Default `false`. If `false`, returns immediately and runs in background for SSE streaming. If `true`, blocks until draft is ready. |

#### Request Example

```json
{
  "message": "Plan a 4-day romantic trip to Kyoto in October with cultural sights and traditional dining, departing from Tokyo on a $2,500 budget.",
  "sync": false
}
```

#### Response (`200 OK` — Async Mode)

```json
{
  "success": true,
  "thread_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "planning"
}
```

#### Response (`200 OK` — Sync Mode)

```json
{
  "success": true,
  "thread_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "guardrail_allowed": true,
  "requires_approval": true,
  "itinerary": "### Day 1 – Arrival in Kyoto...",
  "flight_results": "...",
  "hotel_results": "...",
  "weather_results": "...",
  "budget_results": "...",
  "trip_constraints": {
    "destination": "Kyoto, Japan",
    "origin": "HND",
    "duration": "4 days",
    "budget": "$2500",
    "travel_style": "romantic, cultural",
    "special_preferences": ["traditional dining"]
  }
}
```

#### Error Response (`400 Bad Request`)

```json
{
  "success": false,
  "error": "Message cannot be empty."
}
```

---

### 3.3 Get Trip Snapshot

```http
GET /api/travel/{thread_id}
```

Retrieves current in-memory or persisted PostgreSQL state for a session. Used by the frontend for page reloads, deep linking, and SSE polling fallback.

#### Response (`200 OK`)

```json
{
  "success": true,
  "thread_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "awaiting_approval",
  "user_query": "Plan a 4-day romantic trip to Kyoto...",
  "trip_constraints": {
    "destination": "Kyoto, Japan",
    "origin": "HND",
    "duration": "4 days",
    "budget": "$2500",
    "travel_style": "romantic",
    "special_preferences": ["traditional dining"]
  },
  "payload": {
    "guardrail_allowed": true,
    "requires_approval": true,
    "itinerary": "### Day 1 – Arrival & Gion Exploration...",
    "flight_results": "...",
    "hotel_results": "...",
    "weather_results": "...",
    "budget_results": "...",
    "selected_agents": [
      "flight_agent",
      "hotel_agent",
      "weather_agent",
      "budget_agent",
      "itinerary_agent"
    ]
  },
  "elapsed": 14.2,
  "steps": {
    "supervisor": "done",
    "flight_agent": "done",
    "hotel_agent": "done",
    "weather_agent": "done",
    "budget_agent": "done",
    "itinerary_agent": "done"
  },
  "traces": [
    { "ts": "00:01.2", "text": "Supervisor extracted constraints: destination='Kyoto'" },
    { "ts": "00:03.5", "text": "Weather MCP: 21°C, clear sky in Kyoto" }
  ]
}
```

#### Status Values

- `"planning"`: Multi-agent execution currently running.
- `"awaiting_approval"`: Paused at Human-in-the-Loop review gate.
- `"revising"`: Re-evaluating days based on user feedback.
- `"approved"`: Trip finalized and ready for PDF/Markdown export.
- `"blocked"`: Input guardrail rejected prompt (off-topic / duration > 7 days).
- `"error"`: System failure during agent run.

#### Error Response (`404 Not Found`)

```json
{
  "success": false,
  "error": "Trip session not found."
}
```

---

### 3.4 Stream Trip Events (SSE)

```http
GET /api/travel/{thread_id}/events
Accept: text/event-stream
```

Streams real-time agent execution updates to the browser using standard Server-Sent Events (`EventSource`).

#### Response Headers

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

#### Stream Event Types

##### 1. Agent Step (`type: "step"`)
Notifies progress of individual specialist agents:
```json
data: {"type": "step", "agent": "flight_agent", "status": "running"}

data: {"type": "step", "agent": "flight_agent", "status": "done"}
```
- `status`: `"pending"` | `"running"` | `"done"` | `"skipped"` | `"error"`

##### 2. Live Terminal Trace (`type: "trace"`)
Monospace logging emitted in `<TracePanel />`:
```json
data: {"type": "trace", "line": "[00:04.1] Tavily search executed for boutique ryokans in Kyoto"}
```

##### 3. Final / Interrupt State (`type: "final"`)
Emitted when the itinerary draft is ready for HITL review or when approved:
```json
data: {"type": "final", "payload": {"requires_approval": true, "itinerary": "### Day 1...", "flight_results": "..."}}
```

##### 4. Error Event (`type: "error"`)
Emitted if an unhandled agent exception occurs:
```json
data: {"type": "error", "message": "Failed to connect to weather provider."}
```

---

### 3.5 Human-in-the-Loop Approval & Revision

```http
POST /api/travel/approve
Content-Type: application/json
```

Resumes the paused LangGraph workflow with user approval or targeted revision instructions.

#### Request Body (`ApprovalRequest`)

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `thread_id` | `string` | **Yes** | The active session UUID. |
| `approved` | `boolean` | **Yes** | `true` to approve and seal plan; `false` to request revisions. |
| `feedback` | `string` | **Yes (if not approved)** | Instructions for days to modify (max 1,000 characters). |
| `sync` | `boolean` | No | Default `false`. If `false`, executes in background stream worker. |

#### Request Example (Request Changes)

```json
{
  "thread_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "approved": false,
  "feedback": "Please replace Day 2 temples with a tea ceremony and local food tasting tour.",
  "sync": false
}
```

#### Request Example (Final Approval)

```json
{
  "thread_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "approved": true,
  "feedback": "",
  "sync": false
}
```

#### Response (`200 OK`)

```json
{
  "success": true,
  "thread_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "revising"
}
```

#### Error Response (`400 Bad Request`)

```json
{
  "success": false,
  "error": "Please provide revision feedback when requesting changes."
}
```

---

## 4. cURL Examples

### Test Service Health
```bash
curl -X GET http://127.0.0.1:8000/health
```

### Start Trip Planning (Async Stream)
```bash
curl -X POST http://127.0.0.1:8000/api/travel \
  -H "Content-Type: application/json" \
  -d '{
    "message": "3 days in Rome exploring historical ruins and pasta on a budget of 1000 EUR",
    "sync": false
  }'
```

### Subscribe to SSE Stream
```bash
curl -N -X GET http://127.0.0.1:8000/api/travel/{THREAD_ID}/events
```

### Submit Revision Feedback
```bash
curl -X POST http://127.0.0.1:8000/api/travel/approve \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "{THREAD_ID}",
    "approved": false,
    "feedback": "Add Colosseum underground tour to Day 1 afternoon"
  }'
```

### Approve Itinerary
```bash
curl -X POST http://127.0.0.1:8000/api/travel/approve \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "{THREAD_ID}",
    "approved": true
  }'
```
