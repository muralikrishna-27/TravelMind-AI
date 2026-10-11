# TravelMind AI — Frontend

Modern **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4** frontend for **TravelMind AI**.

For the complete architecture reference, design system tokens, component breakdown, and Vercel deployment instructions, see **[`Frontend.md`](./Frontend.md)**.

## Quick Start (Local Development)

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Ensure `BACKEND_URL=http://127.0.0.1:8000` points to your running FastAPI backend.

3. Start the development server:
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Start Next.js development server on port 3000 |
| `pnpm build` | Create an optimized production build |
| `pnpm start` | Run the compiled production server |
| `pnpm typecheck` | Generate Next.js route types and run `tsc --noEmit` |
| `pnpm lint` | Run ESLint checks |
| `pnpm test` | Run Vitest unit tests (`parse-itinerary`, `trip-machine`) |
| `pnpm test:e2e` | Run Playwright E2E and `@axe-core/playwright` accessibility tests |

## Deploying to Vercel

1. Set the Vercel project **Root Directory** to `frontend`.
2. Add the environment variable `BACKEND_URL` pointing to your deployed FastAPI backend URL (e.g., `https://your-backend.onrender.com`).
3. Deploy — [`vercel.json`](./vercel.json) and [`next.config.ts`](./next.config.ts) automatically configure the build, SSE streaming timeout (`maxDuration: 60`), security headers, and static asset caching.
