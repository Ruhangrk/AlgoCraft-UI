import { Link, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { EventGraphToggle, EventPriceChart, eventSpanNs } from "@/components/EventPriceChart";
import { EventTimeline } from "@/components/EventTimeline";
import { formatPaise } from "@/lib/format";
import { ApiError } from "@/types/api";
import { Button, EmptyState, PageShell, Panel, Stat } from "@/components/ui";

/** Run detail — summary + containers + event timeline. */
export function RunDetailPage() {
  const { workbookId = "", runId = "" } = useParams();
  const wid = Number(workbookId);
  const rid = Number(runId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showGraph, setShowGraph] = useState(false);
  const [graphTicker, setGraphTicker] = useState<string>("");

  const runsQuery = useQuery({
    queryKey: ["runs", wid],
    queryFn: () => api.listRuns(wid, { limit: 200 }),
    enabled: Number.isFinite(wid) && wid > 0,
  });

  const containersQuery = useQuery({
    queryKey: ["containers", wid],
    queryFn: () => api.listContainers(wid),
    enabled: Number.isFinite(wid) && wid > 0,
  });

  const runContainers = (containersQuery.data ?? []).filter(
    (c) => c.run_id == null || c.run_id === rid,
  );

  const eventsQuery = useQuery({
    queryKey: ["run-events", wid, rid],
    queryFn: () => api.listRunEvents(wid, rid, "all"),
    enabled: Number.isFinite(wid) && wid > 0 && Number.isFinite(rid) && rid > 0,
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteRun(wid, rid),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["runs", wid] });
      navigate(`/workbooks/${workbookId}?tab=runs`);
    },
  });

  const run = runsQuery.data?.find((r) => r.id === rid);
  const notFound = !runsQuery.isLoading && !runsQuery.isError && !run;

  const eventsError =
    eventsQuery.error instanceof ApiError
      ? eventsQuery.error.message
      : eventsQuery.isError
        ? "Failed to load events"
        : null;

  const tickers = useMemo(() => {
    const set = new Set<string>();
    for (const c of runContainers) {
      if (c.ticker) {
        set.add(c.ticker);
      }
    }
    for (const e of eventsQuery.data ?? []) {
      const t = e.data.ticker;
      if (t) {
        set.add(t);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [runContainers, eventsQuery.data]);

  const activeTicker = graphTicker || tickers[0] || "";
  const span = useMemo(() => eventSpanNs(eventsQuery.data), [eventsQuery.data]);

  return (
    <PageShell
      title={run ? `Run #${run.id}` : `Run #${runId}`}
      subtitle="Routing run summary after capital return."
      actions={
        <Link
          to={`/workbooks/${workbookId}?tab=runs`}
          className="text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        >
          ← Workbook
        </Link>
      }
    >
      {runsQuery.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
      ) : runsQuery.isError ? (
        <EmptyState
          title="Could not load run"
          body={
            runsQuery.error instanceof ApiError
              ? runsQuery.error.message
              : "Failed to load workbook runs."
          }
        />
      ) : notFound ? (
        <EmptyState
          title="Run not found"
          body="This id is not in the workbook run list (hidden or never existed)."
        />
      ) : run ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-6">
            <p className="mb-2 text-xs font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
              Run #{run.id} · {run.router}
            </p>
            <p className="font-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              {formatPaise(run.returned_paise)}
            </p>
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">Capital returned to workbook</p>
            <div className="mt-4 grid gap-3 border-t border-[var(--color-line)] pt-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] tracking-wide text-[var(--color-ink-muted)] uppercase">
                  Selected
                </p>
                <p className="mt-0.5 font-mono text-sm tabular-nums">{run.selected}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-wide text-[var(--color-ink-muted)] uppercase">
                  Fills
                </p>
                <p className="mt-0.5 font-mono text-sm tabular-nums">{run.fills}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-wide text-[var(--color-ink-muted)] uppercase">
                  Created
                </p>
                <p className="mt-0.5 font-mono text-sm tabular-nums">{run.created_at || "—"}</p>
              </div>
            </div>
          </div>

          <Panel
            title="Details"
            action={
              <Button
                type="button"
                variant="secondary"
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (!window.confirm(`Hide run #${rid} from history? (soft-delete)`)) {
                    return;
                  }
                  deleteMut.mutate();
                }}
              >
                {deleteMut.isPending ? "Hiding…" : "Hide from history"}
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Router" value={run.router} />
              <Stat label="Selected" value={String(run.selected)} />
              <Stat label="Fills" value={String(run.fills)} />
              <Stat label="Returned" value={formatPaise(run.returned_paise)} />
            </div>
            {deleteMut.isError ? (
              <p className="mt-3 text-sm text-[var(--color-danger)]">
                {deleteMut.error instanceof ApiError
                  ? deleteMut.error.message
                  : "Hide failed"}
              </p>
            ) : null}
          </Panel>

          <Panel title="Containers">
            {runContainers.length === 0 ? (
              <EmptyState
                title="No containers"
                body="Containers for this run appear after selection."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs tracking-wide text-[var(--color-ink-muted)] uppercase">
                    <tr>
                      <th className="pb-2 font-medium">Id</th>
                      <th className="pb-2 font-medium">Ticker</th>
                      <th className="pb-2 font-medium">Strategy</th>
                      <th className="pb-2 font-medium">Mode</th>
                      <th className="pb-2 font-medium">Allocation</th>
                      <th className="pb-2 font-medium">Fills</th>
                      <th className="pb-2 font-medium">Realized</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]">
                    {runContainers.map((c) => (
                      <tr key={c.id} className="hover:bg-[var(--color-paper)]">
                        <td className="py-2 font-mono">
                          <Link
                            className="text-[var(--color-accent)] hover:underline"
                            to={`/workbooks/${workbookId}/containers/${c.id}`}
                          >
                            {c.id}
                          </Link>
                        </td>
                        <td className="py-2 font-medium">{c.ticker}</td>
                        <td className="py-2">{c.strategy}</td>
                        <td className="py-2 font-mono text-xs">{c.mode}</td>
                        <td className="py-2 font-mono">
                          {c.allocation_paise != null ? formatPaise(c.allocation_paise) : "—"}
                        </td>
                        <td className="py-2 font-mono">{c.fills}</td>
                        <td className="py-2 font-mono">{formatPaise(c.realized_paise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Events"
            action={
              <div className="flex flex-wrap items-center gap-2">
                {tickers.length > 1 ? (
                  <select
                    className="rounded-md border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm"
                    value={activeTicker}
                    onChange={(e) => setGraphTicker(e.target.value)}
                    aria-label="Graph ticker"
                  >
                    {tickers.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : null}
                <EventGraphToggle
                  open={showGraph}
                  disabled={!span || !activeTicker}
                  onToggle={() => setShowGraph((v) => !v)}
                />
              </div>
            }
          >
            {showGraph && span && activeTicker ? (
              <EventPriceChart
                ticker={activeTicker}
                fromNs={span.fromNs}
                toNs={span.toNs}
                events={eventsQuery.data ?? []}
              />
            ) : null}
            <EventTimeline
              events={eventsQuery.data}
              loading={eventsQuery.isLoading}
              error={eventsError}
            />
          </Panel>
        </div>
      ) : null}
    </PageShell>
  );
}
