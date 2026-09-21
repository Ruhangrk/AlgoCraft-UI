import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { formatPaise } from "@/lib/format";
import { formatReturnPct } from "@/lib/time";
import { ApiError, type BacktestRow, type RunSummary } from "@/types/api";
import { Button, EmptyState, Field, TextInput } from "@/components/ui";

const PAGE = 40;

export type HistoryTab = "runs" | "backtests";

function resolveReturnPct(row: { return_pct?: number; return_pct_bp: number }): number {
  if (typeof row.return_pct === "number") {
    return row.return_pct;
  }
  return row.return_pct_bp / 100;
}

export function WorkbookHistory({
  workbookId,
  tab,
  onTabChange,
}: {
  workbookId: number;
  tab: HistoryTab;
  onTabChange: (tab: HistoryTab) => void;
}) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cursor, setCursor] = useState(0);
  const [extraRuns, setExtraRuns] = useState<RunSummary[]>([]);
  const [extraBts, setExtraBts] = useState<BacktestRow[]>([]);

  useEffect(() => {
    setCursor(0);
    setExtraRuns([]);
    setExtraBts([]);
  }, [tab, from, to]);

  const listParams = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      limit: PAGE,
      cursor: cursor > 0 ? cursor : undefined,
    }),
    [from, to, cursor],
  );

  const runsQuery = useQuery({
    queryKey: ["runs", workbookId, from, to, cursor],
    queryFn: () => api.listRuns(workbookId, listParams),
    enabled: Number.isFinite(workbookId) && workbookId > 0 && tab === "runs",
  });

  const backtestsQuery = useQuery({
    queryKey: ["backtests", workbookId, from, to, cursor],
    queryFn: () => api.listBacktests(workbookId, listParams),
    enabled: Number.isFinite(workbookId) && workbookId > 0 && tab === "backtests",
  });

  const runs = useMemo(() => {
    const page = runsQuery.data ?? [];
    const all = cursor > 0 ? [...extraRuns, ...page] : page;
    const needle = q.trim().toLowerCase();
    if (!needle) {
      return all;
    }
    return all.filter(
      (r) => String(r.id).includes(needle) || r.router.toLowerCase().includes(needle),
    );
  }, [runsQuery.data, extraRuns, cursor, q]);

  const backtests = useMemo(() => {
    const page = backtestsQuery.data ?? [];
    const all = cursor > 0 ? [...extraBts, ...page] : page;
    const needle = q.trim().toLowerCase();
    if (!needle) {
      return all;
    }
    return all.filter(
      (b) =>
        String(b.id).includes(needle) ||
        b.ticker.toLowerCase().includes(needle) ||
        b.strategy.toLowerCase().includes(needle),
    );
  }, [backtestsQuery.data, extraBts, cursor, q]);

  const pageLen = tab === "runs" ? (runsQuery.data?.length ?? 0) : (backtestsQuery.data?.length ?? 0);
  const canLoadMore = !q.trim() && pageLen >= PAGE;

  const deleteBt = useMutation({
    mutationFn: (id: number) => api.deleteBacktest(workbookId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["backtests", workbookId] });
      setCursor(0);
      setExtraBts([]);
    },
  });

  const deleteRunMut = useMutation({
    mutationFn: (id: number) => api.deleteRun(workbookId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["runs", workbookId] });
      setCursor(0);
      setExtraRuns([]);
    },
  });

  function loadMore() {
    if (tab === "runs") {
      const page = runsQuery.data ?? [];
      if (!page.length) {
        return;
      }
      setExtraRuns((prev) => [...prev, ...page]);
      setCursor(page[page.length - 1].id);
    } else {
      const page = backtestsQuery.data ?? [];
      if (!page.length) {
        return;
      }
      setExtraBts((prev) => [...prev, ...page]);
      setCursor(page[page.length - 1].id);
    }
  }

  function confirmDelete(kind: "run" | "backtest", id: number) {
    if (!window.confirm(`Hide this ${kind} #${id} from history? (soft-delete)`)) {
      return;
    }
    if (kind === "run") {
      deleteRunMut.mutate(id);
    } else {
      deleteBt.mutate(id);
    }
  }

  const err =
    (tab === "runs" && runsQuery.error) || (tab === "backtests" && backtestsQuery.error);
  const errMsg =
    err instanceof ApiError ? err.message : err ? "Failed to load history" : null;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-[var(--color-line)] pb-3">
        <TabButton active={tab === "runs"} onClick={() => onTabChange("runs")}>
          Runs
        </TabButton>
        <TabButton active={tab === "backtests"} onClick={() => onTabChange("backtests")}>
          Backtests
        </TabButton>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="Search">
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "runs" ? "id or router…" : "ticker / strategy…"}
          />
        </Field>
        <Field label="From">
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => {
              setQ("");
              setFrom("");
              setTo("");
            }}
          >
            Clear filters
          </Button>
        </div>
      </div>

      {errMsg ? <p className="text-sm text-[var(--color-danger)]">{errMsg}</p> : null}

      {tab === "backtests" ? (
        backtestsQuery.isLoading && cursor === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
        ) : backtests.length === 0 ? (
          <EmptyState
            title="No backtests match"
            body="Run a manual backtest or widen filters."
          />
        ) : (
          <HistoryTable>
            <thead className="text-xs tracking-wide text-[var(--color-ink-muted)] uppercase">
              <tr>
                <th className="pb-2 font-medium">Id</th>
                <th className="pb-2 font-medium">When</th>
                <th className="pb-2 font-medium">Ticker</th>
                <th className="pb-2 font-medium">Strategy</th>
                <th className="pb-2 font-medium">Return</th>
                <th className="pb-2 font-medium">Fees</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {backtests.map((bt) => {
                const pct = resolveReturnPct(bt);
                return (
                  <tr key={bt.id} className="hover:bg-[var(--color-paper)]">
                    <td className="py-2 font-mono">
                      <Link
                        className="text-[var(--color-accent)] hover:underline"
                        to={`/workbooks/${workbookId}/backtests/${bt.id}`}
                      >
                        {bt.id}
                      </Link>
                    </td>
                    <td className="py-2 font-mono text-xs text-[var(--color-ink-muted)]">
                      {bt.created_at?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="py-2 font-medium">{bt.ticker}</td>
                    <td className="py-2">{bt.strategy}</td>
                    <td
                      className="py-2 font-mono"
                      style={{ color: pct >= 0 ? "var(--color-gain)" : "var(--color-loss)" }}
                    >
                      {formatReturnPct(pct)}
                    </td>
                    <td className="py-2 font-mono">{formatPaise(bt.fees_paise)}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-danger)]"
                        onClick={() => confirmDelete("backtest", bt.id)}
                      >
                        Hide
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </HistoryTable>
        )
      ) : runsQuery.isLoading && cursor === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
      ) : runs.length === 0 ? (
        <EmptyState title="No runs match" body="Start a routing run or widen filters." />
      ) : (
        <HistoryTable>
          <thead className="text-xs tracking-wide text-[var(--color-ink-muted)] uppercase">
            <tr>
              <th className="pb-2 font-medium">Id</th>
              <th className="pb-2 font-medium">When</th>
              <th className="pb-2 font-medium">Router</th>
              <th className="pb-2 font-medium">Selected</th>
              <th className="pb-2 font-medium">Fills</th>
              <th className="pb-2 font-medium">Returned</th>
              <th className="pb-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {runs.map((run) => (
              <tr key={run.id} className="hover:bg-[var(--color-paper)]">
                <td className="py-2 font-mono">
                  <Link
                    className="text-[var(--color-accent)] hover:underline"
                    to={`/workbooks/${workbookId}/runs/${run.id}`}
                  >
                    {run.id}
                  </Link>
                </td>
                <td className="py-2 font-mono text-xs text-[var(--color-ink-muted)]">
                  {run.created_at?.slice(0, 10) ?? "—"}
                </td>
                <td className="py-2">{run.router}</td>
                <td className="py-2 font-mono">{run.selected}</td>
                <td className="py-2 font-mono">{run.fills}</td>
                <td className="py-2 font-mono">{formatPaise(run.returned_paise)}</td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-danger)]"
                    onClick={() => confirmDelete("run", run.id)}
                  >
                    Hide
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </HistoryTable>
      )}

      {canLoadMore ? (
        <Button
          type="button"
          variant="secondary"
          disabled={tab === "runs" ? runsQuery.isFetching : backtestsQuery.isFetching}
          onClick={loadMore}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}

function HistoryTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">{children}</table>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md px-3 py-1.5 text-sm font-medium transition",
        active
          ? "bg-[var(--color-ink)] text-white"
          : "text-[var(--color-ink-muted)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
