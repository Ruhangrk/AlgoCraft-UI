# Joint roadmap — AlgoCraft + AlgoCraft-UI

**Audience:** Cascade / agents working in either repo.  
**Companion docs:** `ARCHITECTURE.md` (this UI repo), `core_front_idea.txt`, `../AlgoCraft/Notes/CODEMAP.md`.

**Do not create new files when not needed** — for both repos. Prefer extending existing modules (`api/*_routes`, `endpoints.ts`, pages, repositories, migrations). Add a file only when it owns a clear boundary (new route group, new page, new repository, new migration) and keeps code length / ownership clean. If an edit fits an existing file without bloating it, edit that file.

**Backend note:** Backend work is planned elsewhere / in parallel. This file’s **frontend plan is the source of truth for UI**. Each FE step lists the **API contract it expects**; implement UI against that contract (hide or disable actions until the endpoint exists — no fake data screens).

---

## 0. Current baseline

### Backend (Crow) — paths UI must speak

| Area | Paths |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Catalog | `GET /strategies`, `GET /routing-algos` |
| Market | `POST /market-data/ensure` |
| Workbooks | `GET/POST /workbooks`, `POST .../runs/start`, `GET .../runs\|fills\|portfolio\|containers` |
| Live | WS `/ws/workbooks/{wid}/portfolio`, `/ws/workbooks/{wid}/containers` |
| CORS | Enabled on Crow |

**Not exposed yet (FE must not fake):** instruments search, OHLCV charts, manual backtest CRUD, activity soft-delete, event timeline APIs.

### Frontend today (U0–U3)

Login/register, workbook list/create, sync routing run, runs/containers/fills on one fat workbook page. Vite `/api` proxy. Optional `workbookCache` workaround — remove after list-after-create is verified.

---

# Frontend product plan (authoritative)

## 1. Product identity

AlgoCraft-UI is a **research + execution workstation**, not a marketing site and not a generic SaaS dashboard.

Sellable = **trust** (honest numbers/states) + **speed** (search/chart/backtest feel snappy) + **clarity** (one job per screen) + **polish** (restrained type/spacing/motion).

**Visual direction (locked):** light research console — paper ground, ink text, one green accent (go/money), one red (loss/danger). IBM Plex Sans + Mono. Tables over card grids. Charts flush in their panel. Avoid purple gradients, glass everywhere, neon, emoji, pill spam, decorative motion.

**Motion budget:** page enter fade, result metric settle, chart series draw — nothing else.

**Rules (from `core_front_idea.txt`):** display + commands only; paise/ns until view layer; one data path (API → Query → UI); no half-wired pretty screens; keyboard paths for primary actions.

---

## 2. Information architecture — pages & routes

**v1 = 8 routes.** Features that are not listed here are **panels/tabs inside these pages**, not new URLs.

| # | Route | Page | Single job |
|---|---|---|---|
| 1 | `/login` | Login | Sign in |
| 2 | `/register` | Register | Create account |
| 3 | `/workbooks` | Workbook list | Create / open workspaces |
| 4 | `/workbooks/:wid` | **Workbook hub** | Capital + launch + **history index** |
| 5 | `/workbooks/:wid/backtests/:bid` | Backtest detail | What happened in one backtest |
| 6 | `/workbooks/:wid/runs/:rid` | Run detail | What happened in one routing run |
| 7 | `/markets` | Markets | NSE search home |
| 8 | `/markets/:ticker` | Stock detail | D/W/M chart + stock meta |

**Not separate pages (compose into the above):**

| Feature | Lives in |
|---|---|
| Instrument search | Shared control (`InstrumentSearch`) |
| Start backtest / start run | Forms on Workbook hub |
| History Backtests \| Runs | **Tabs on Workbook hub** |
| Fills / event timeline | Sections on Backtest / Run detail |
| Chart overlays | Stock detail and/or activity detail |

**Later (not v1 routes):** container deep-link, paper, admin.

**Markets are global** (NSE catalog is not workbook-owned). Optional “Backtest this” from stock detail jumps to hub with ticker prefilled.

---

## 3. Navigation — how the user jumps

```
/login ⇄ /register
    │
    ▼
/workbooks  ──open/create──►  /workbooks/:wid
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
   History tab click      Launch backtest/run      Shell → Markets
         │                       │                       │
         ▼                       ▼                       ▼
  .../backtests/:bid      (then open detail)       /markets
  .../runs/:rid                                         │
         │                                              ▼
         └──────── breadcrumb back to hub ────── /markets/:ticker
                                                      │
                                          “Backtest this” → hub (prefilled)
```

**Logged-in shell:** AlgoCraft · Workbooks · Markets · (current workbook name when inside `:wid`) · user / logout.

**After a successful launch:** invalidate history queries → new row at top of the right tab → **navigate to detail** so the “what happened” moment is immediate.

---

## 4. Workbook history model (core product surface)

History is permanent under each workbook. Hub = **index**; detail routes = **full story of one subsection**.

```
Workbook
├── Capital strip (live)
├── Launch (new backtest / new run)
└── History (archive)
    ├── Tab: Backtests[]  →  /workbooks/:wid/backtests/:bid
    └── Tab: Runs[]       →  /workbooks/:wid/runs/:rid
```

### Hub history tabs (efficient index)

| Tab | Row shows at a glance |
|---|---|
| **Backtests** | When · ticker · strategy · range · **return %** · fees · status |
| **Runs** | When · router · # selected/containers · fills · returned ₹ / P&L |

- Newest first. Filter: text (ticker/strategy) + optional date range.  
- Cursor/limit pagination when lists grow — never dump unbounded rows.  
- Soft-delete (when API exists): hide from tab; no hard-delete in UI.  
- **Do not** put fills/signals/timelines on the hub — only on detail.

### List row DTO (enough for table without opening detail)

```
id, type (backtest|run), created_at, status,
identity (ticker+strategy | router),
headline (return_pct | returned_paise / pnl),
optional: fees_paise, fills_count, range_from, range_to
```

### Detail pages (full “what happened”)

| Page | Content |
|---|---|
| **Backtest detail** | Hero **% return after costs** · capital · fees · Sharpe / drawdown / win rate · fills table · event timeline |
| **Run detail** | Summary · container table · fills · event timeline (signals, rejections, lifecycle, routing) |

Heavy payloads (fills, events) load **on detail only**.

### History loop

```
/workbooks/:wid  [History → Backtests | Runs]
        │ row click
        ▼
detail route
        │ breadcrumb “← Workbook”
        ▼
/workbooks/:wid  (same tab restored)
```

---

## 5. Shared UI primitives (create only when needed)

Prefer these few reusable pieces over one-off layouts:

| Primitive | Role |
|---|---|
| `AppShell` | Nav + outlet |
| `InstrumentSearch` | Keyboard-first NSE combobox |
| `CandleChart` | lightweight-charts wrapper (TF props) |
| `ActivityResultHeader` | Big % / P&L + fee line |
| `HistoryTable` | Shared table chrome for both tabs |
| `EventTimeline` | Layer-togglable event list |
| Existing `components/ui.tsx` | Button, Field, Panel, PageShell, etc. |

Extend `ui.tsx` first; split a primitive out only when it would bloat that file or is reused 3+ times.

---

## 6. Frontend steps (do in order)

Each step: implement UI → smoke against live API (or clearly disabled if API missing) → update progress log → stop for approval.

Suggested product order: **shell & API hygiene → markets search → backtest money moment → charts → history polish → event timeline**.

---

### FE-0 — Shell, routes, Crow adoption

**Goal:** Professional shell + correct API client; remove dead workarounds.

**UI work:**

- Add `AppShell` + route table for all 8 paths (detail/markets can be placeholder pages with honest empty states).  
- Diff `endpoints.ts` / types vs Crow; fix DTO drift.  
- Verify `GET /workbooks` after create; **delete `workbookCache` if fixed**.  
- WS client stub ready (connect when hub mounts) or defer until FE-5 — don’t leave broken sockets.  
- Lock CSS tokens in `index.css` (ink, paper, accent, danger, mono).

**Expects API:** existing Crow auth/workbooks/runs.  
**Done when:** Login → list shows created workbook → open hub → shell nav works; no local cache hack unless still required.

---

### FE-1 — NSE universe (Markets + search)

**Goal:** Any NSE equity selectable via search (not free-typed CSV forever).

**UI work:**

- `/markets` with `InstrumentSearch` + recent results.  
- Wire search into Workbook hub launchers (replace raw ticker text where possible).  
- `/markets/:ticker` shell (header + “chart coming”) until FE-3.

**Expects API:** `GET /instruments?q=&limit=` (and optional `GET /instruments/{ticker}`).  
**Until API exists:** keep text ticker input; search UI disabled with clear message — no fake instrument list.  
**Done when:** Type “RELI” → pick RELIANCE → ticker flows into launcher state.

---

### FE-2 — Manual backtest (sellable money moment)

**Goal:** Strategy × stock × range → clear **% P&L after all costs**.

**UI work:**

- On hub: Backtest launcher (InstrumentSearch, strategy select from `GET /strategies`, date range, capital).  
- Honest blocking “Running…” while sync POST runs.  
- On success: go to `/workbooks/:wid/backtests/:bid` with `ActivityResultHeader` (**big return %**, fees, net ₹).  
- Fills table on detail (reuse patterns from today’s fills UI).  
- History tab **Backtests** lists rows (FE-4 hardens filters).

**Expects API:**  
`POST /workbooks/{wid}/backtests/start` → `{ backtest_id, return_pct, realized_pnl_paise, fees_paise, ... }`  
`GET /workbooks/{wid}/backtests`, `GET .../backtests/{id}` (+ fills).  
**Done when:** User can complete one backtest and explain the result from the detail page alone.

---

### FE-3 — Stock D/W/M charts

**Goal:** Clean basic views for a stock.

**UI work:**

- Finish `/markets/:ticker`: TF toggle Daily / Weekly / Monthly, `CandleChart`, coverage/meta line.  
- Loading / empty / error states first-class.  
- CTA “Backtest this” → hub with ticker prefilled.

**Expects API:** `GET /instruments/{ticker}/ohlcv?resolution=1m|1d|1w|1M&from=&to=` (`1m` ≤ 3 calendar days).  
**Done when:** INFY (or any symbol with data) shows D/W/M without glitches; missing data is explicit.

---

### FE-4 — History organization at scale

**Goal:** Dozens/hundreds of backtests + runs stay navigable.

**UI work:**

- Hub History: tabs Backtests | Runs using `HistoryTable`.  
- Filters (query + dates), pagination.  
- Soft-delete actions when API exists.  
- Preserve tab in URL query optional (`?tab=backtests`) for back navigation.  
- Routing **Runs** detail page parity with backtest detail (containers + summary).

**Expects API:** list/filter/cursor; `DELETE` soft-delete; rich run summary if needed.  
**Done when:** 20+ backtests + several runs remain usable without clutter.

---

### FE-5 — Event tracing

**Goal:** Show why the engine did what it did.

**Event layers (toggles):** signals → rejections → fills → container lifecycle → routing decisions → capital events.

**UI work:**

- `EventTimeline` on backtest + run detail.  
- Optional markers on chart when chart+events share a detail view.  
- Subscribe hub capital/containers to WS when useful (live strip).

**Expects API:**  
`GET .../backtests/{id}/events?include=...` and/or `GET .../runs/{id}/events?include=...`  
(or per-container events).  
**Done when:** After a run/backtest, user sees signals/rejections/lifecycle without opening SQLite.

---

## 7. Frontend sequence (summary)

```
FE-0  App shell + 8 routes + Crow client hygiene
FE-1  Markets + InstrumentSearch
FE-2  Manual backtest + % P&L detail + backtests tab
FE-3  Stock D/W/M charts
FE-4  History tabs/filters/pagination (+ run detail polish)
FE-5  Event timeline (+ WS where applicable)
```

Routing-run launcher already exists from U3 — keep on hub; fold into History **Runs** tab during FE-0/FE-4 instead of a ninth page.

---

## 8. Backend contracts the UI will need (checklist for engine team)

Not owned by this FE plan, but FE steps block on them:

| When | Contract |
|---|---|
| FE-1 | `GET /instruments?q=&limit=` |
| FE-2 | Backtest start + get + list (with `return_pct`, fees) |
| FE-3 | `GET /instruments/{ticker}/ohlcv?...` |
| FE-4 | Filtered activity lists + soft-delete |
| FE-5 | Events read APIs; WS auth documented |

---

## 9. Architecture rules (frontend)

1. **8 routes max for v1** — new features compose into hub/detail/markets.  
2. **History = hub index + detail story** — never only ephemeral UI state.  
3. **API → TanStack Query → views** — invalidate after mutations; refetch on focus.  
4. **No trading math in React** — display `return_pct` / paise from API.  
5. **Do not create new files when not needed** — see top of file.  
6. **Hide, don’t fake** — if API missing, disable with reason.

---

## 10. Progress log

| Step | Status | Date | Notes |
|---|---|---|---|
| FE-0 | **Done** | 2026-09-21 | AppShell, 8 routes, list-after-create OK, workbookCache removed, history tabs |
| FE-1 | **Done** | 2026-09-21 | InstrumentSearch, Markets, stock header, hub ticker chips; TanStack Query cache |
| FE-2 | **Done** | 2026-09-21 | Manual backtest launcher, % P&L detail, backtests history tab |
| FE-3 | **Done** | 2026-09-21 | Stock D/W/M CandleChart + OHLCV Query cache (10m stale) |
| FE-4 | **Done** | 2026-09-21 | History filters/pagination/soft-delete; run detail polish; `?tab=` |
| FE-5 | **Done** | 2026-09-21 | EventTimeline on run detail (layer toggles); backtest events honest empty |

---

## 11. Open FE decisions

| # | Topic | Status |
|---|---|---|
| 1 | Markets global vs under workbook | **Locked: global** `/markets` |
| 2 | Visual direction | **Locked: light research console** |
| 3 | After launch navigate to detail | **Locked: yes** |
| 4 | Vite `/api` proxy vs direct CORS | Keep proxy for now |
| 5 | `?tab=` on hub for history | **Locked: yes** (`?tab=backtests`) |
