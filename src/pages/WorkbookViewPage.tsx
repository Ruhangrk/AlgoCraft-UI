import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import * as api from "@/api/endpoints";
import { formatNs, formatPaise, rupeesToPaise } from "@/lib/format";
import { mergeWorkbooks, readKnownWorkbooks } from "@/lib/workbookCache";
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

const DEFAULT_TICKERS = "RELIANCE,INFY,TCS";
const DEFAULT_STRATEGIES = "ema_crossover,vwap_reversion,opening_range_breakout";

export function WorkbookViewPage() {
  const { workbookId = "" } = useParams();
  const wid = Number(workbookId);
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [capitalRupees, setCapitalRupees] = useState("");
  const [tickers, setTickers] = useState(DEFAULT_TICKERS);
  const [strategies, setStrategies] = useState(DEFAULT_STRATEGIES);
  const [router, setRouter] = useState("default_router");
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RunStartResponse | null>(null);

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

  const known = user ? readKnownWorkbooks(user.id) : [];
  const workbook = useMemo(() => {
    const merged = mergeWorkbooks(workbooksQuery.data ?? [], known);
    return merged.find((w) => w.id === wid) ?? null;
  }, [workbooksQuery.data, known, wid]);

  const portfolioQuery = useQuery({
    queryKey: ["portfolio", wid],
    queryFn: () => api.getPortfolio(wid),
    enabled: Number.isFinite(wid) && wid > 0,
    refetchOnWindowFocus: true,
  });

  const runsQuery = useQuery({
    queryKey: ["runs", wid],
    queryFn: () => api.listRuns(wid),
    enabled: Number.isFinite(wid) && wid > 0,
    refetchOnWindowFocus: true,
  });

  const containersQuery = useQuery({
    queryKey: ["containers", wid],
    queryFn: () => api.listContainers(wid),
    enabled: Number.isFinite(wid) && wid > 0,
    refetchOnWindowFocus: true,
  });

  const fillsQuery = useQuery({
    queryKey: ["fills", wid],
    queryFn: () => api.listFills(wid),
    enabled: Number.isFinite(wid) && wid > 0,
    refetchOnWindowFocus: true,
  });

  const startMutation = useMutation({
    mutationFn: () => {
      const body: Parameters<typeof api.startRun>[1] = {
        tickers: splitCsv(tickers),
        strategies: splitCsv(strategies),
        router,
      };
      if (capitalRupees.trim()) {
        body.capital_paise = rupeesToPaise(Number(capitalRupees));
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
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Run failed");
    },
  });

  function onStart(e: FormEvent) {
    e.preventDefault();
    setLastResult(null);
    startMutation.mutate();
  }

  const title = workbook?.name ?? `Workbook ${wid}`;
  const mainPaise = portfolioQuery.data?.main_capital_paise ?? workbook?.main_capital_paise;
  const availablePaise =
    portfolioQuery.data?.available_paise ?? workbook?.available_paise;

  return (
    <PageShell
      title={title}
      subtitle="Launch a routing run (synchronous). The UI blocks until the engine returns."
      actions={
        <>
          <Link
            to="/workbooks"
            className="text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            ← Workbooks
          </Link>
          <Button variant="secondary" type="button" onClick={logout}>
            Log out
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Panel title="Capital">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Workbook id" value={String(wid)} />
            <Stat
              label="Main"
              value={mainPaise != null ? formatPaise(mainPaise) : "—"}
            />
            <Stat
              label="Available"
              value={availablePaise != null ? formatPaise(availablePaise) : "—"}
            />
          </div>
          {portfolioQuery.isError ? (
            <p className="mt-3 text-xs text-[var(--color-warn)]">
              Portfolio endpoint unavailable for this id — capital may still be readable from
              create cache.
            </p>
          ) : null}
        </Panel>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Panel title="Start routing run">
            <form className="space-y-3" onSubmit={onStart}>
              <Field label="Capital (₹)" hint="Optional — defaults to workbook available.">
                <TextInput
                  type="number"
                  min={0}
                  step={1}
                  value={capitalRupees}
                  onChange={(e) => setCapitalRupees(e.target.value)}
                  placeholder="use available"
                />
              </Field>
              <Field label="Tickers" hint="Comma-separated.">
                <TextInput value={tickers} onChange={(e) => setTickers(e.target.value)} required />
              </Field>
              <Field
                label="Strategies"
                hint={
                  catalogQuery.data
                    ? `Available: ${catalogQuery.data.strategiesList.join(", ")}`
                    : undefined
                }
              >
                <TextInput
                  value={strategies}
                  onChange={(e) => setStrategies(e.target.value)}
                  required
                />
              </Field>
              <Field
                label="Router"
                hint={
                  catalogQuery.data
                    ? `Available: ${catalogQuery.data.routers.join(", ")}`
                    : undefined
                }
              >
                <TextInput value={router} onChange={(e) => setRouter(e.target.value)} required />
              </Field>
              <ErrorBanner message={error} />
              <Button type="submit" className="w-full" disabled={startMutation.isPending}>
                {startMutation.isPending ? "Running… (waiting on engine)" : "Start run"}
              </Button>
              {lastResult ? (
                <div className="rounded-lg bg-[var(--color-paper)] px-3 py-2 font-mono text-xs leading-relaxed">
                  run #{lastResult.run_id} · selected {lastResult.selected} · skipped{" "}
                  {lastResult.skipped} · fills {lastResult.fills} · returned{" "}
                  {formatPaise(lastResult.returned_paise)} · signals {lastResult.signals} ·
                  rejections {lastResult.rejections}
                </div>
              ) : null}
            </form>
          </Panel>

          <div className="space-y-6">
            <Panel
              title="Runs"
              action={
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => void runsQuery.refetch()}
                  disabled={runsQuery.isFetching}
                >
                  Refresh
                </Button>
              }
            >
              {(runsQuery.data ?? []).length === 0 ? (
                <EmptyState title="No runs yet" body="Start a run to populate history." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="text-xs tracking-wide text-[var(--color-ink-muted)] uppercase">
                      <tr>
                        <th className="pb-2 font-medium">Id</th>
                        <th className="pb-2 font-medium">Router</th>
                        <th className="pb-2 font-medium">Selected</th>
                        <th className="pb-2 font-medium">Fills</th>
                        <th className="pb-2 font-medium">Returned</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-line)]">
                      {runsQuery.data?.map((run) => (
                        <tr key={run.id}>
                          <td className="py-2 font-mono">{run.id}</td>
                          <td className="py-2">{run.router}</td>
                          <td className="py-2 font-mono">{run.selected}</td>
                          <td className="py-2 font-mono">{run.fills}</td>
                          <td className="py-2 font-mono">{formatPaise(run.returned_paise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Containers">
              {(containersQuery.data ?? []).length === 0 ? (
                <EmptyState title="No containers" body="Containers appear after a successful run." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="text-xs tracking-wide text-[var(--color-ink-muted)] uppercase">
                      <tr>
                        <th className="pb-2 font-medium">Id</th>
                        <th className="pb-2 font-medium">Ticker</th>
                        <th className="pb-2 font-medium">Strategy</th>
                        <th className="pb-2 font-medium">Mode</th>
                        <th className="pb-2 font-medium">Fills</th>
                        <th className="pb-2 font-medium">Realized</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-line)]">
                      {containersQuery.data?.map((c) => (
                        <tr key={c.id}>
                          <td className="py-2 font-mono">{c.id}</td>
                          <td className="py-2 font-medium">{c.ticker}</td>
                          <td className="py-2">{c.strategy}</td>
                          <td className="py-2 font-mono text-xs">{c.mode}</td>
                          <td className="py-2 font-mono">{c.fills}</td>
                          <td className="py-2 font-mono">{formatPaise(c.realized_paise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Fills">
              {(fillsQuery.data ?? []).length === 0 ? (
                <EmptyState title="No fills" body="Fill history for this workbook." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
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
                      {fillsQuery.data?.map((f, i) => (
                        <tr key={`${f.timestamp_ns}-${i}`}>
                          <td className="py-2 font-mono text-xs">{formatNs(f.timestamp_ns)}</td>
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
            </Panel>
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
