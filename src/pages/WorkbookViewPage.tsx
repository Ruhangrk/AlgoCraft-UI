import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { InstrumentSearch } from "@/components/InstrumentSearch";
import { WorkbookHistory, type HistoryTab } from "@/features/WorkbookHistory";
import { useWorkbookStatusSockets } from "@/hooks/useWorkbookStatusSockets";
import { formatNs, formatPaise, rupeesToPaise } from "@/lib/format";
import { PrefKeys, loadJson, saveJson } from "@/lib/prefs";
import { istDateToNs, istTodayYmd } from "@/lib/time";
import { ApiError, type RunStartResponse } from "@/types/api";
import {
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  PageShell,
  Panel,
  Stat,
  TextInput,
} from "@/components/ui";

const PREFILL_KEY = "algocraft_prefill_ticker";
const DEFAULT_TICKERS = ["RELIANCE", "INFY", "TCS"];
const DEFAULT_STRATEGIES = "ema_crossover,vwap_reversion,opening_range_breakout";
const DEFAULT_TRADE_FROM = "09:15";
const DEFAULT_TRADE_TO = "15:30";

export function WorkbookViewPage() {
  const { workbookId = "" } = useParams();
  const wid = Number(workbookId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const tab: HistoryTab = searchParams.get("tab") === "backtests" ? "backtests" : "runs";

  const [capitalRupees, setCapitalRupees] = useState("");
  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS);
  const [strategies, setStrategies] = useState(DEFAULT_STRATEGIES);
  const [router, setRouter] = useState("default_router");
  const routingPref = useMemo(
    () => loadJson<{
      anchorDate?: string;
      evalSessions?: string;
      tradeFrom?: string;
      tradeTo?: string;
      useSessionWindow?: boolean;
    }>(PrefKeys.routingRun),
    [],
  );
  const backtestPref = useMemo(
    () => loadJson<{ from?: string; to?: string }>(PrefKeys.backtestDates),
    [],
  );

  const [anchorDate, setAnchorDate] = useState(
    () => routingPref?.anchorDate || istTodayYmd(),
  );
  const [evalSessions, setEvalSessions] = useState(
    () => routingPref?.evalSessions || "14",
  );
  const [tradeFrom, setTradeFrom] = useState(
    () => routingPref?.tradeFrom || DEFAULT_TRADE_FROM,
  );
  const [tradeTo, setTradeTo] = useState(
    () => routingPref?.tradeTo || DEFAULT_TRADE_TO,
  );
  const [useSessionWindow, setUseSessionWindow] = useState(
    () => routingPref?.useSessionWindow ?? true,
  );
  const [liveActive, setLiveActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RunStartResponse | null>(null);

  const [btTicker, setBtTicker] = useState("RELIANCE");
  const [btStrategy, setBtStrategy] = useState("ema_crossover");
  const [btFrom, setBtFrom] = useState(() => backtestPref?.from || "2026-08-28");
  const [btTo, setBtTo] = useState(() => backtestPref?.to || "2026-09-11");
  const [btCapital, setBtCapital] = useState("100000");
  const [btError, setBtError] = useState<string | null>(null);

  const [rechargeRupees, setRechargeRupees] = useState("100000");
  const [rechargeError, setRechargeError] = useState<string | null>(null);
  const [rechargeOk, setRechargeOk] = useState<string | null>(null);

  const [fillTicker, setFillTicker] = useState<string>("all");
  const [fillSide, setFillSide] = useState<"all" | "buy" | "sell">("all");

  useEffect(() => {
    saveJson(PrefKeys.routingRun, {
      anchorDate,
      evalSessions,
      tradeFrom,
      tradeTo,
      useSessionWindow,
    });
  }, [anchorDate, evalSessions, tradeFrom, tradeTo, useSessionWindow]);

  useEffect(() => {
    saveJson(PrefKeys.backtestDates, { from: btFrom, to: btTo });
  }, [btFrom, btTo]);

  useEffect(() => {
    const fromUrl = searchParams.get("ticker")?.toUpperCase();
    const fromSession = sessionStorage.getItem(PREFILL_KEY)?.toUpperCase() ?? null;
    const prefill = fromUrl || fromSession;
    if (!prefill) {
      return;
    }
    setTickers((prev) => (prev.includes(prefill) ? prev : [prefill, ...prev]));
    setBtTicker(prefill);
    sessionStorage.removeItem(PREFILL_KEY);
    if (fromUrl) {
      const next = new URLSearchParams(searchParams);
      next.delete("ticker");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useWorkbookStatusSockets(wid, Number.isFinite(wid) && wid > 0);

  const todayIst = istTodayYmd();
  const isLiveAnchor = anchorDate === todayIst;

  const workbooksQuery = useQuery({
    queryKey: ["workbooks"],
    queryFn: api.listWorkbooks,
  });

  const catalogQuery = useQuery({
    queryKey: ["catalog"],
    queryFn: async () => {
      const [strategiesList, routers] = await Promise.all([
        api.listStrategies(),
        api.listRoutingAlgos(),
      ]);
      return { strategiesList, routers };
    },
    staleTime: 60_000,
  });

  const workbook = useMemo(
    () => workbooksQuery.data?.find((w) => w.id === wid) ?? null,
    [workbooksQuery.data, wid],
  );

  const portfolioQuery = useQuery({
    queryKey: ["portfolio", wid],
    queryFn: () => api.getPortfolio(wid),
    enabled: Number.isFinite(wid) && wid > 0,
  });

  const containersQuery = useQuery({
    queryKey: ["containers", wid],
    queryFn: () => api.listContainers(wid),
    enabled: Number.isFinite(wid) && wid > 0 && tab === "runs",
  });

  const fillsQuery = useQuery({
    queryKey: ["fills", wid],
    queryFn: () => api.listFills(wid),
    enabled: Number.isFinite(wid) && wid > 0 && tab === "runs",
  });

  const fillTickers = useMemo(() => {
    const set = new Set<string>();
    for (const f of fillsQuery.data ?? []) {
      if (f.ticker) {
        set.add(f.ticker);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [fillsQuery.data]);

  const filteredFills = useMemo(() => {
    const rows = fillsQuery.data ?? [];
    return rows.filter((f) => {
      if (fillTicker !== "all" && f.ticker !== fillTicker) {
        return false;
      }
      if (fillSide === "all") {
        return true;
      }
      const s = String(f.side ?? "").toUpperCase();
      if (fillSide === "buy") {
        return s === "BUY" || s === "B" || s === "LONG";
      }
      return s === "SELL" || s === "S" || s === "SHORT";
    });
  }, [fillsQuery.data, fillTicker, fillSide]);

  const startMutation = useMutation({
    mutationFn: () => {
      const body: Parameters<typeof api.startRun>[1] = {
        tickers,
        strategies: splitCsv(strategies),
        router,
        anchor_date: anchorDate,
        eval_sessions: Math.max(1, Number(evalSessions) || 14),
      };
      if (capitalRupees.trim()) {
        body.capital_paise = rupeesToPaise(Number(capitalRupees));
      }
      if (useSessionWindow) {
        body.trade_from = tradeFrom || DEFAULT_TRADE_FROM;
        body.trade_to = tradeTo || DEFAULT_TRADE_TO;
      }
      return api.startRun(wid, body);
    },
    onSuccess: (result) => {
      setLastResult(result);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["runs", wid] });
      void queryClient.invalidateQueries({ queryKey: ["containers", wid] });
      void queryClient.invalidateQueries({ queryKey: ["fills", wid] });
      void queryClient.invalidateQueries({ queryKey: ["portfolio", wid] });
      void queryClient.invalidateQueries({ queryKey: ["workbooks"] });
      setSearchParams({ tab: "runs" });

      const live = result.mode === "live" && result.live === true;
      setLiveActive(live);
      if (!live && result.run_id > 0) {
        navigate(`/workbooks/${wid}/runs/${result.run_id}`);
      }
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Run failed");
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => api.stopRun(wid),
    onSuccess: (res) => {
      setLiveActive(false);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["runs", wid] });
      void queryClient.invalidateQueries({ queryKey: ["containers", wid] });
      void queryClient.invalidateQueries({ queryKey: ["fills", wid] });
      void queryClient.invalidateQueries({ queryKey: ["portfolio", wid] });
      void queryClient.invalidateQueries({ queryKey: ["workbooks"] });
      if (res.run_id > 0) {
        navigate(`/workbooks/${wid}/runs/${res.run_id}`);
      }
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Stop failed");
    },
  });

  const backtestMutation = useMutation({
    mutationFn: () =>
      api.startBacktest(wid, {
        ticker: btTicker,
        strategy: btStrategy,
        capital_paise: rupeesToPaise(Number(btCapital)),
        from_ns: istDateToNs(btFrom, false),
        to_ns: istDateToNs(btTo, true),
      }),
    onSuccess: (row) => {
      setBtError(null);
      // Simulated capital only — workbook balance unchanged.
      void queryClient.invalidateQueries({ queryKey: ["backtests", wid] });
      setSearchParams({ tab: "backtests" });
      navigate(`/workbooks/${wid}/backtests/${row.id}`);
    },
    onError: (err) => {
      setBtError(err instanceof ApiError ? err.message : "Backtest failed");
    },
  });

  const rechargeMutation = useMutation({
    mutationFn: () => api.addWorkbookCapital(wid, rupeesToPaise(Number(rechargeRupees))),
    onSuccess: (row) => {
      setRechargeError(null);
      setRechargeOk(`Added ${formatPaise(row.added_paise)} · available now ${formatPaise(row.available_paise)}`);
      void queryClient.invalidateQueries({ queryKey: ["portfolio", wid] });
      void queryClient.invalidateQueries({ queryKey: ["workbooks"] });
    },
    onError: (err) => {
      setRechargeOk(null);
      setRechargeError(err instanceof ApiError ? err.message : "Recharge failed");
    },
  });

  function onStartRun(e: FormEvent) {
    e.preventDefault();
    if (tickers.length === 0) {
      setError("Add at least one ticker");
      return;
    }
    setLastResult(null);
    startMutation.mutate();
  }

  function onStartBacktest(e: FormEvent) {
    e.preventDefault();
    setBtError(null);
    try {
      istDateToNs(btFrom, false);
      istDateToNs(btTo, true);
    } catch (err) {
      setBtError(err instanceof Error ? err.message : "Invalid dates");
      return;
    }
    if (!btTicker.trim()) {
      setBtError("Pick a ticker");
      return;
    }
    if (!(Number(btCapital) > 0)) {
      setBtError("Simulated capital must be positive");
      return;
    }
    backtestMutation.mutate();
  }

  function onRecharge(e: FormEvent) {
    e.preventDefault();
    setRechargeError(null);
    setRechargeOk(null);
    const amt = Number(rechargeRupees);
    if (!(amt > 0)) {
      setRechargeError("Enter a positive amount in ₹");
      return;
    }
    rechargeMutation.mutate();
  }

  function setTab(next: HistoryTab) {
    setSearchParams(next === "runs" ? {} : { tab: next });
  }

  const title = workbook?.name ?? `Workbook ${wid}`;
  const mainPaise = portfolioQuery.data?.main_capital_paise ?? workbook?.main_capital_paise;
  const availablePaise = portfolioQuery.data?.available_paise ?? workbook?.available_paise;
  const strategyOptions = catalogQuery.data?.strategiesList ?? [];
  const routerOptions = catalogQuery.data?.routers ?? [];

  useEffect(() => {
    if (routerOptions.length === 0) {
      return;
    }
    if (!routerOptions.includes(router)) {
      setRouter(routerOptions[0]);
    }
  }, [routerOptions, router]);

  return (
    <PageShell
      title={title}
      subtitle="Capital, launch experiments, and browse permanent history for this workbook."
      actions={
        <Link
          to="/workbooks"
          className="text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        >
          ← Workbooks
        </Link>
      }
    >
      <div className="space-y-6">
        <Panel title="Capital">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Workbook id" value={String(wid)} />
            <Stat label="Main" value={mainPaise != null ? formatPaise(mainPaise) : "—"} />
            <Stat
              label="Available"
              value={availablePaise != null ? formatPaise(availablePaise) : "—"}
            />
          </div>
          <form className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--color-line)] pt-4" onSubmit={onRecharge}>
            <Field label="Recharge (₹)" hint="Adds to main + available (for routing runs).">
              <TextInput
                type="number"
                min={1}
                step={1}
                value={rechargeRupees}
                onChange={(e) => setRechargeRupees(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" disabled={rechargeMutation.isPending}>
              {rechargeMutation.isPending ? "Adding…" : "Add capital"}
            </Button>
            <ErrorBanner message={rechargeError} />
            {rechargeOk ? (
              <p className="w-full text-sm text-[var(--color-gain)]">{rechargeOk}</p>
            ) : null}
          </form>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-6">
            <Panel title="Manual backtest">
              <form className="space-y-3" onSubmit={onStartBacktest}>
                <Field label="Stock">
                  <InstrumentSearch
                    placeholder="Search ticker…"
                    onSelect={(inst) => setBtTicker(inst.ticker)}
                  />
                  <p className="mt-1 font-mono text-sm font-medium">{btTicker}</p>
                </Field>
                <Field label="Strategy">
                  <select
                    className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                    value={btStrategy}
                    onChange={(e) => setBtStrategy(e.target.value)}
                  >
                    {(strategyOptions.length ? strategyOptions : [btStrategy]).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="From">
                    <TextInput type="date" value={btFrom} onChange={(e) => setBtFrom(e.target.value)} required />
                  </Field>
                  <Field label="To">
                    <TextInput type="date" value={btTo} onChange={(e) => setBtTo(e.target.value)} required />
                  </Field>
                </div>
                <Field
                  label="Simulated capital (₹)"
                  hint="Paper starting capital for this backtest only — not taken from the workbook."
                >
                  <TextInput
                    type="number"
                    min={1}
                    step={1}
                    value={btCapital}
                    onChange={(e) => setBtCapital(e.target.value)}
                    required
                  />
                </Field>
                <ErrorBanner message={btError} />
                <Button type="submit" className="w-full" disabled={backtestMutation.isPending}>
                  {backtestMutation.isPending ? "Running backtest…" : "Run backtest"}
                </Button>
              </form>
            </Panel>

            <Panel title="Routing run">
              <form className="space-y-3" onSubmit={onStartRun}>
                <Field
                  label="Anchor day"
                  hint={
                    isLiveAnchor
                      ? "Equals IST today → live Upstox tape until you stop."
                      : "Past session → hist replay (eval window shifts back from this day)."
                  }
                >
                  <TextInput
                    type="date"
                    value={anchorDate}
                    onChange={(e) => setAnchorDate(e.target.value)}
                    required
                    disabled={liveActive}
                  />
                </Field>
                <p className="font-mono text-[10px] text-[var(--color-ink-muted)]">
                  Mode: {isLiveAnchor ? "live" : "hist_replay"} · IST today {todayIst}
                </p>
                <Field
                  label="Eval sessions"
                  hint="Prior closed days the router uses to score strategies (e.g. 14 or 20)."
                >
                  <TextInput
                    type="number"
                    min={1}
                    step={1}
                    value={evalSessions}
                    onChange={(e) => setEvalSessions(e.target.value)}
                    required
                    disabled={liveActive}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                  <input
                    type="checkbox"
                    checked={useSessionWindow}
                    disabled={liveActive}
                    onChange={(e) => setUseSessionWindow(e.target.checked)}
                  />
                  Limit trade window (IST)
                </label>
                {useSessionWindow ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Trade from">
                      <TextInput
                        type="time"
                        value={tradeFrom}
                        onChange={(e) => setTradeFrom(e.target.value)}
                        required
                        disabled={liveActive}
                      />
                    </Field>
                    <Field label="Trade to">
                      <TextInput
                        type="time"
                        value={tradeTo}
                        onChange={(e) => setTradeTo(e.target.value)}
                        required
                        disabled={liveActive}
                      />
                    </Field>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    Full NSE session used for the trade day.
                  </p>
                )}
                <Field label="Capital (₹)" hint="Optional — defaults to workbook available. Borrowed for the run.">
                  <TextInput
                    type="number"
                    min={0}
                    step={1}
                    value={capitalRupees}
                    onChange={(e) => setCapitalRupees(e.target.value)}
                    placeholder="use available"
                    disabled={liveActive}
                  />
                </Field>
                <Field label="Tickers" hint="Search NSE catalog and add symbols.">
                  <InstrumentSearch
                    placeholder="Add stock…"
                    disabled={liveActive}
                    onSelect={(inst) =>
                      setTickers((prev) =>
                        prev.includes(inst.ticker) ? prev : [...prev, inst.ticker],
                      )
                    }
                  />
                  {tickers.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {tickers.map((t) => (
                        <li key={t}>
                          <button
                            type="button"
                            disabled={liveActive}
                            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-0.5 font-mono text-xs hover:border-[var(--color-danger)] disabled:opacity-50"
                            onClick={() => setTickers((prev) => prev.filter((x) => x !== t))}
                            title="Remove"
                          >
                            {t}
                            <span aria-hidden>×</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-[var(--color-warn)]">No tickers selected</p>
                  )}
                </Field>
                <Field label="Strategies">
                  <TextInput
                    value={strategies}
                    onChange={(e) => setStrategies(e.target.value)}
                    required
                    disabled={liveActive}
                  />
                </Field>
                <Field label="Router">
                  <select
                    className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
                    value={routerOptions.includes(router) ? router : ""}
                    onChange={(e) => setRouter(e.target.value)}
                    required
                    disabled={liveActive || catalogQuery.isLoading || routerOptions.length === 0}
                  >
                    {routerOptions.length === 0 ? (
                      <option value="">
                        {catalogQuery.isLoading ? "Loading routers…" : "No routers available"}
                      </option>
                    ) : (
                      routerOptions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))
                    )}
                  </select>
                </Field>
                <ErrorBanner message={error} />
                {liveActive ? (
                  <div className="space-y-2">
                    <p className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)]">
                      Live run active — portfolio &amp; containers update over WebSocket. Capital
                      settles when you stop.
                    </p>
                    <Button
                      type="button"
                      className="w-full"
                      variant="secondary"
                      disabled={stopMutation.isPending}
                      onClick={() => stopMutation.mutate()}
                    >
                      {stopMutation.isPending ? "Stopping…" : "Stop live run"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      startMutation.isPending ||
                      tickers.length === 0 ||
                      !router ||
                      routerOptions.length === 0
                    }
                  >
                    {startMutation.isPending
                      ? isLiveAnchor
                        ? "Starting live…"
                        : "Running hist replay…"
                      : isLiveAnchor
                        ? "Start live run (today)"
                        : "Start hist replay"}
                  </Button>
                )}
                {lastResult ? (
                  <div className="rounded-lg bg-[var(--color-paper)] px-3 py-2 font-mono text-xs leading-relaxed">
                    {lastResult.mode ?? "run"}
                    {lastResult.live ? " · live" : ""}
                    {lastResult.run_id > 0 ? ` · run #${lastResult.run_id}` : " · run pending stop"}
                    {" · "}
                    selected {lastResult.selected} · fills {lastResult.fills}
                    {lastResult.anchor_date ? ` · anchor ${lastResult.anchor_date}` : ""}
                    {lastResult.eval_sessions != null
                      ? ` · eval ${lastResult.eval_sessions}`
                      : ""}
                    {lastResult.mode !== "live"
                      ? ` · returned ${formatPaise(lastResult.returned_paise)}`
                      : null}
                  </div>
                ) : null}
              </form>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="History">
              <WorkbookHistory workbookId={wid} tab={tab} onTabChange={setTab} />
            </Panel>

            {tab === "runs" ? (
              <>
                <Panel title="Containers (workbook)">
                  {(containersQuery.data ?? []).length === 0 ? (
                    <EmptyState title="No containers" body="Appear after a successful run." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px] text-left text-sm">
                        <thead className="text-xs tracking-wide text-[var(--color-ink-muted)] uppercase">
                          <tr>
                            <th className="pb-2 font-medium">Id</th>
                            <th className="pb-2 font-medium">Run</th>
                            <th className="pb-2 font-medium">Ticker</th>
                            <th className="pb-2 font-medium">Strategy</th>
                            <th className="pb-2 font-medium">Mode</th>
                            <th className="pb-2 font-medium">Allocation</th>
                            <th className="pb-2 font-medium">Realized</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-line)]">
                          {containersQuery.data?.map((c) => (
                            <tr key={c.id} className="hover:bg-[var(--color-paper)]">
                              <td className="py-2 font-mono">
                                <Link
                                  className="text-[var(--color-accent)] hover:underline"
                                  to={`/workbooks/${wid}/containers/${c.id}`}
                                >
                                  {c.id}
                                </Link>
                              </td>
                              <td className="py-2 font-mono text-xs">
                                {c.run_id != null ? (
                                  <Link
                                    className="text-[var(--color-accent)] hover:underline"
                                    to={`/workbooks/${wid}/runs/${c.run_id}`}
                                  >
                                    {c.run_id}
                                  </Link>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-2 font-medium">{c.ticker}</td>
                              <td className="py-2">{c.strategy}</td>
                              <td className="py-2 font-mono text-xs">{c.mode}</td>
                              <td className="py-2 font-mono">
                                {c.allocation_paise != null
                                  ? formatPaise(c.allocation_paise)
                                  : "—"}
                              </td>
                              <td className="py-2 font-mono">{formatPaise(c.realized_paise)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>

                <Panel title="Fills (workbook)">
                  {(fillsQuery.data ?? []).length === 0 ? (
                    <EmptyState title="No fills" body="Fill history for this workbook." />
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col gap-1 text-xs text-[var(--color-ink-muted)]">
                          Instrument
                          <select
                            className="rounded-md border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                            value={fillTicker}
                            onChange={(e) => setFillTicker(e.target.value)}
                          >
                            <option value="all">All</option>
                            {fillTickers.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-[var(--color-ink-muted)]">
                          Side
                          <select
                            className="rounded-md border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                            value={fillSide}
                            onChange={(e) =>
                              setFillSide(e.target.value as "all" | "buy" | "sell")
                            }
                          >
                            <option value="all">All</option>
                            <option value="buy">Buy only</option>
                            <option value="sell">Sell only</option>
                          </select>
                        </label>
                        <p className="pb-1.5 font-mono text-[10px] text-[var(--color-ink-muted)]">
                          {filteredFills.length} / {(fillsQuery.data ?? []).length}
                        </p>
                      </div>
                      {filteredFills.length === 0 ? (
                        <EmptyState
                          title="No fills match"
                          body="Widen instrument or side filters."
                        />
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[520px] text-left text-sm">
                            <thead className="text-xs tracking-wide text-[var(--color-ink-muted)] uppercase">
                              <tr>
                                <th className="pb-2 font-medium">Time</th>
                                <th className="pb-2 font-medium">Ticker</th>
                                <th className="pb-2 font-medium">Side</th>
                                <th className="pb-2 font-medium">Qty</th>
                                <th className="pb-2 font-medium">Price</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-line)]">
                              {filteredFills.map((f, i) => (
                                <tr key={`${f.timestamp_ns}-${i}`}>
                                  <td className="py-2 font-mono text-xs">
                                    {formatNs(f.timestamp_ns)}
                                  </td>
                                  <td className="py-2 font-medium">{f.ticker}</td>
                                  <td className="py-2 font-mono text-xs">{f.side}</td>
                                  <td className="py-2 font-mono">{f.qty}</td>
                                  <td className="py-2 font-mono">{formatPaise(f.price_paise)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </Panel>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
