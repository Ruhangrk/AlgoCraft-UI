# AlgoCraft-UI

React frontend for the AlgoCraft C++ trading engine. The UI issues commands and displays results; trading, risk, and capital rules stay in the backend.

Workbook-centric: auth → workbooks → runs / backtests / containers → markets. An optional side panel talks to AlgoCraft-Agent (FastAPI) for chat-assisted workflows.

## Stack

| Layer | Choice |
| --- | --- |
| Build | Vite 7 |
| UI | React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Routing | React Router 7 |
| Server state | TanStack Query |
| Charts | TradingView lightweight-charts |

## Prerequisites

- **Node.js** 20+ (npm 9+)
- **AlgoCraft** HTTP API on `127.0.0.1:8080` (required for most screens)
- **AlgoCraft-Agent** on `127.0.0.1:8100` (optional; agent chat / SSE)

The C++ API does not send CORS headers. In development, Vite proxies browser requests so the app stays same-origin.

## Setup

```bash
cp .env.example .env
npm install --maxsockets=3
```

`--maxsockets=3` keeps npm from opening too many parallel connections on constrained networks.

Default env (`.env.example`):

```bash
# Dev: Vite proxies /api → AlgoCraft :8080
VITE_API_URL=/api
```

Optional override for the agent proxy target path (defaults to `/agent` if unset):

```bash
VITE_AGENT_URL=/agent
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server at `http://127.0.0.1:5173` with API/agent proxies |
| `npm run build` | Typecheck (`tsc -b`) then production bundle to `dist/` |
| `npm run preview` | Serve the production build locally (same host/port as dev) |

```bash
npm run dev
npm run build
npm run preview
```

## Dev proxies

Configured in `vite.config.ts`:

| Browser path | Forwards to | Role |
| --- | --- | --- |
| `/api/*` | `http://127.0.0.1:8080/*` | AlgoCraft REST + SSE |
| `/agent/*` | `http://127.0.0.1:8100/*` | AlgoCraft-Agent (JWT, catalog, chat, SSE) |

Start AlgoCraft (and the agent if you need chat) before using the UI. Without the engine, login and workbook calls will fail.

## Project layout

```
src/
  api/          HTTP client, endpoints, agent client
  auth/         JWT storage, AuthProvider, route guards
  pages/        Route-level screens
  features/     Workbook/agent UI blocks
  components/   Shared UI (charts, shell, primitives)
  hooks/        Streams and query helpers
  lib/          Formatting, prefs, time helpers
  types/        API DTOs
notes/          Architecture and joint FE/BE roadmap
```

Money is kept in **paise** and timestamps in **ns** until display. Format only in the view layer; never reshape units in API payloads.

## Docs

- [`notes/ARCHITECTURE.md`](notes/ARCHITECTURE.md) — product shape, stack, backend contract
- [`notes/JOINT_ROADMAP.md`](notes/JOINT_ROADMAP.md) — shared FE/BE work

Backend source of truth for HTTP lives in the AlgoCraft repo (`http_server` / API notes there).
