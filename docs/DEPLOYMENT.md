# Production Deployment & Hosting Guide

This guide walks through deploying **TravelMind AI** to production with a distributed architecture:
- **Frontend:** Deployed to **Vercel** (Edge/Node.js).
- **Backend:** Deployed to **Render**, **Railway**, or any **Docker** host.
- **Database:** Managed **PostgreSQL** (Render, Neon, Supabase, or AWS RDS).

---

## 1. Production Architecture

```mermaid
flowchart LR
    subgraph Browser ["Traveler Client"]
        USER["Browser / Mobile"]
    end

    subgraph Vercel ["Vercel Edge Network"]
        FE["Next.js 16 App Router (frontend/)"]
        PROXY["SSE Proxy Route Handler (/api/travel/:id/events)"]
    end

    subgraph Cloud ["Backend Cloud (Render / Railway / Docker)"]
        API["FastAPI + LangGraph Service (:8000)"]
        FAST_MCP["Custom Weather MCP Subprocess"]
    end

    subgraph DB ["Database"]
        PG[("PostgreSQL Checkpointer")]
    end

    USER --> FE
    FE -->|"REST Rewrites"| API
    FE -->|"EventSource SSE"| PROXY
    PROXY -->|"Internal Stream"| API
    API <--> PG
    API <--> FAST_MCP
```

---

## 2. Backend Deployment

### Option A: Render (Recommended)

1. **Create Managed PostgreSQL Database:**
   - On [Render Dashboard](https://dashboard.render.com), click **New +** → **PostgreSQL**.
   - Name: `travelmind-db`.
   - Copy the **External Database URL**.

2. **Create Web Service:**
   - Click **New +** → **Web Service**.
   - Connect your GitHub repository.
   - **Root Directory:** Leave empty (repository root).
   - **Environment:** `Python 3`.
   - **Build Command:**
     ```bash
     pip install --upgrade pip && pip install uv && pip install -r requirements.txt
     ```
   - **Start Command:**
     ```bash
     uvicorn app:app --host 0.0.0.0 --port 8000 --workers 2
     ```

3. **Configure Environment Variables:**
   Under **Environment Variables**, add:
   ```env
   GROQ_API_KEY=gsk_...
   TAVILY_API_KEY=tvly-...
   AVIATION_STACK_API_KEY=...
   OPENWEATHER_API_KEY=...
   DATABASE_URL=postgresql://user:pass@host.render.com/dbname?sslmode=require
   ALLOWED_ORIGINS=https://your-frontend.vercel.app
   ALLOW_VERCEL_PREVIEWS=true
   ```

4. **Verify Deployment:**
   ```bash
   curl https://your-backend.onrender.com/health
   # Expected response: {"status":"ok","checkpointer":"postgres",...}
   ```

---

### Option B: Docker Container

The repository includes an optimized multi-stage `Dockerfile`:

```bash
# 1. Build Docker image
docker build -t travelmind-ai-backend:latest .

# 2. Run container with environment file
docker run -d \
  --name travelmind-backend \
  -p 8000:8000 \
  --env-file .env \
  travelmind-ai-backend:latest

# 3. Check logs and health
docker logs -f travelmind-backend
curl http://localhost:8000/health
```

---

## 3. Frontend Deployment (Vercel)

The `frontend/` directory is pre-configured with `vercel.json`, `.vercelignore`, and `next.config.ts`.

### Step-by-Step Vercel Setup

1. Open [Vercel Dashboard](https://vercel.com/new) and import the `TravelMind-AI` repository.
2. In the project import screen:
   - **Framework Preset:** Next.js
   - **Root Directory:** Click **Edit** and select `frontend`.
3. Under **Environment Variables**, add:
   | Variable | Value | Environment |
   | :--- | :--- | :--- |
   | `BACKEND_URL` | `https://your-backend.onrender.com` *(no trailing slash)* | Production, Preview, Development |
4. Click **Deploy**.

### Routing in Production
- Browser requests to `/api/travel`, `/api/travel/approve`, and `/api/health` are automatically rewritten by `next.config.ts` to `${BACKEND_URL}`.
- SSE requests (`/api/travel/[threadId]/events`) are handled by the Node.js route handler with `maxDuration = 60` and `X-Accel-Buffering: no`.
- If an SSE stream times out on serverless infrastructure, the frontend `useTripStream` hook automatically falls back to snapshot polling (`GET /api/travel/:threadId`) every 2 seconds without user disruption.

---

## 4. Security & Hardening Checklist

- [x] **No Hard-Coded Secrets:** Verify that `.env` is listed in `.gitignore` and never committed to version control.
- [x] **Content Security Policy (CSP):** Strict CSP configured in `frontend/next.config.ts` blocking unauthorized origins and script injection.
- [x] **XSS Sanitization:** All LLM outputs sanitized via `rehype-sanitize` in `<SafeMarkdown />`.
- [x] **PostgreSQL SSL:** `sslmode=require` automatically appended to `DATABASE_URL` connections.
- [x] **CORS Origins:** Production backend restricts CORS to authorized frontend domains.
- [x] **Input Guardrails:** Server-side validation screens off-topic prompts and enforces the 7-day maximum trip duration.
