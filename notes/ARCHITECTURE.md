# AlgoCraft-UI — Architecture & Phases

Companion to `../AlgoCraft/Notes/` (especially `ARCHITECTURE.md` Phase 8 / API §4.12–4.16, `IMPLEMENTATION.md` Phase 8, `CODEMAP.md`).  
Backend Phase 5 is complete enough to start the UI. This repo owns the React frontend only.

**Next joint work (FE + BE):** see [`JOINT_ROADMAP.md`](./JOINT_ROADMAP.md) — Crow API adoption, NSE universe, charts, manual backtest, history, event tracing.

---

## 1. Purpose

Workbook-centric dashboard for AlgoCraft:

- Auth (register / login / JWT)
- Workbook list and workspace (capital, activities)
- Start routing-algo runs, inspect containers / fills / portfolio
- Later: charts, manual backtest/paper, live WS, admin

UI never runs trading logic. It only commands the C++ API and displays results.

---

## 2. Product shape

```
Login / Register
        │
        ▼
Workbook list  ──create──►  Workbook workspace
                                ├── Capital strip (main / available)
                                ├── Launch: routing run
                                ├── Launch: manual backtest   (API later)
                                ├── Launch: manual paper      (API later)
                                ├── Activity list (runs → containers)
                                └── Container detail (fills now; chart later)
```

**Capital model (must stay visible in UI):**  
Workbook owns capital → activity borrows → containers trade → capital ± P&L returns.

---

## 3. Tech stack

| Layer | Choice |
|---|---|
| Scaffold | Vite + React + TypeScript (preferred over CRA for the real app) |
| Styling | TailwindCSS |
| Routing | React Router |
| Server state | TanStack Query |
| Charts (later) | TradingView `lightweight-charts` |
| Auth storage | JWT in `localStorage`, `Authorization: Bearer <token>` |
| Config | `VITE_API_URL` → AlgoCraft HTTP base (e.g. `http://127.0.0.1:8080`) |

Money stays in **paise** until display. Timestamps stay in **ns** until display.

---

## 4. Frontend layout

```
AlgoCraft-UI/
├── notes/                 ← this document (+ future phase notes)
└── src/                   ← product app
    ├── api/               # fetch client, JWT header, error mapping
    ├── auth/              # token store, AuthProvider, route guards
    ├── pages/             # Login, Register, WorkbookList, WorkbookView, ContainerDetail
    ├── features/          # run-launcher, capital, activity-table, fills, charts
    ├── hooks/             # useWorkbook, useRun, usePortfolio
    ├── types/             # API DTOs
    └── components/        # shared primitives only
```

Pages sketched in AlgoCraft `ARCHITECTURE.md` §7 (frontend):

- `Login.tsx`, `Register.tsx`
- `WorkbookList.tsx`, `WorkbookView.tsx`
- `Backtest.tsx`, `PaperTrade.tsx` (when APIs exist)
- Components: `CapitalInput`, `StockSelector`, `ContainerCard`, `ContainerChart`, `WorkbookSummaryChart`, `PnLChart`

---

## 5. Backend contract (what exists today)

Source of truth: `../AlgoCraft/src/api/http_server.cpp`.

### Ready now

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Workbooks | `GET /workbooks`, `POST /workbooks` |
| Runs | `POST /workbooks/{wid}/runs/start`, `GET /workbooks/{wid}/runs` |
| Reads | `GET /workbooks/{wid}/portfolio`, `.../containers`, `.../fills` |
| Catalog | `GET /strategies`, `GET /routing-algos` |

### Quirks that shape UX

1. **`runs/start` is synchronous** — blocks until the engine finishes; UI shows “Running…” then opens run detail.
2. **Crow WS** exists for portfolio/containers snapshots; UI still uses HTTP invalidate after runs (WS optional later).
3. **Run events** via `GET .../runs/{id}/events` (signals/rejections/fills/routing/lifecycle). Backtest event timeline not in API yet.
4. **`GET /workbooks` works after create** (verified 2026-09-21). Local `workbookCache` removed in FE-0.

See [`JOINT_ROADMAP.md`](./JOINT_ROADMAP.md) for FE-0…FE-5.

### API smoke (2026-09-21)

Crow on `:8080`: register/me, create+list workbooks, strategies, routing-algos OK. CORS `*`.

---

## 6. UI requirements (from AlgoCraft Phase 8)

### Milestone A — Auth + workbook home

- Login / register
- JWT on every API request
- Workbook list: name, capital, status, activity count
- Create / open / soft-delete workbook

### Milestone B — Workbook workspace

- Capital overview + add-capital
- Three launchers: routing run, manual backtest, manual paper (each with capital)
- Activity list (current + historical)
- Emergency STOP (needs backend stop)

### Milestone C — Charts

- Per-container: candlesticks, indicator overlays, entry/exit markers, risk rejections, mode badges (toggleable)
- Workbook summary equity curve
- Detail panel: fills, P&L, signal log
- Needs `GET /workbooks/{wid}/containers/{cid}/chart`

### Milestone D — Admin + polish

- Soft-delete activities from UI
- Admin: all users’ workbooks, hard-delete
- Multi-router / strategy config panels

**Out of scope for this repo until much later:** AI chatbot (`AI_AGENT.md`).

---

## 7. Phases (this repo)

Each phase: implement → smoke against running AlgoCraft API → stop for approval before the next.

| Phase | Goal | Backend dependency | Done when |
|---|---|---|---|
| **U0** | Scaffold | none | Vite/React/TS/Tailwind, `VITE_API_URL`, folder layout, app boots |
| **U1** | Auth | ready | Register, login, `/auth/me` gate, logout |
| **U2** | Workbook list | ready | List + create; navigate into workspace shell |
| **U3** | Run loop | ready (sync) | Launch form → blocking “Running…” → summary → runs / containers / fills |
| **U4** | Workbook depth | needs PATCH/DELETE (+ optional GET by id) | Add capital, rename, soft-delete workbook |
| **U5** | Live status | needs real WS and/or async runs + stop | Streaming portfolio/containers; STOP button works |
| **U6** | Charts | needs chart API | Candles + fills + signals + rejections overlays |
| **U7** | Manual backtest / paper | needs those APIs | Second and third launchers |
| **U8** | Admin | needs admin routes | Cross-user workbooks, hard-delete |

**First build track:** U0 → U1 → U2 → U3 (full vertical slice on today’s API).  
**U4–U8:** blocked on AlgoCraft API gaps unless explicitly mocked.

### Sync run UX (locked for U3)

Honest blocking UI: disable Start, show “Running…”, wait for HTTP response. No fake progress bar until the backend exposes async jobs.

---

## 8. Open decisions

Record answers here as they are settled:

| # | Topic | Status |
|---|---|---|
| 1 | Sync run UX | **Locked:** honest blocking until async API exists |
| 2 | Visual direction | TBD — dense operator console vs quieter research workspace |
| 3 | Charts library | **Default:** `lightweight-charts` |
| 4 | Stub missing APIs? | TBD — wait on backend vs mock for U4+ |
| 5 | CRA sample | **Removed** — product app is the Vite tree at repo root |

---

## 9. Relation to AlgoCraft

```
AlgoCraft-UI (this repo)          AlgoCraft (../AlgoCraft)
  React / TypeScript        ──HTTP/WS──►  Thread 4 API
                                          Auth JWT
                                          Workbook-scoped handlers
```

- Do not call Upstox or touch RocksDB/SQLite from the UI.
- Soft-delete by default in UI; hard-delete is admin-only when available.
- Kill switch / stop is engine-side; UI only sends the command when the endpoint exists.
