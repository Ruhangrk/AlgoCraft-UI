import { Link, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { ActivityResultHeader } from "@/components/ActivityResultHeader";
import { DailyValueTable } from "@/components/DailyValueTable";
import { EventGraphToggle, EventPriceChart, eventSpanNs } from "@/components/EventPriceChart";
import { EventTimeline } from "@/components/EventTimeline";
import { buildDailyEquityFromFills } from "@/lib/containerDailyEquity";
import { formatNs, formatPaise } from "@/lib/format";
import { ApiError, type RunEventLayer } from "@/types/api";
import { EmptyState, PageShell, Panel, Stat } from "@/components/ui";

const BACKTEST_LAYERS: { id: RunEventLayer; label: string }[] = [
  { id: "signal", label: "Signals" },
  { id: "rejection", label: "Rejections" },
  { id: "fill", label: "Fills" },
];

function resolveReturnPct(row: { return_pct?: number; return_pct_bp: number }): number {
  if (typeof row.return_pct === "number") {
    return row.return_pct;
  }
  return row.return_pct_bp / 100;
}

export function BacktestDetailPage() {
  const { workbookId = "", backtestId = "" } = useParams();
  const wid = Number(workbookId);
  const bid = Number(backtestId);
  const [showGraph, setShowGraph] = useState(false);
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const [focusSeq, setFocusSeq] = useState(0);

  const detailQuery = useQuery({
    queryKey: ["backtests", wid, bid],
    queryFn: () => api.getBacktest(wid, bid),
    enabled: Number.isFinite(wid) && wid > 0 && Number.isFinite(bid) && bid > 0,
  });

  const eventsQuery = useQuery({
    queryKey: ["backtest-events", wid, bid],
    queryFn: () => api.listBacktestEvents(wid, bid, "all"),
    enabled: Number.isFinite(wid) && wid > 0 && Number.isFinite(bid) && bid > 0,
  });

  const row = detailQuery.data;
  const span = useMemo(() => {
    if (row) {
      return { fromNs: row.from_ns, toNs: row.to_ns };
    }
    return eventSpanNs(eventsQuery.data);
  }, [row, eventsQuery.data]);

  const dailyRows = useMemo(
    () => buildDailyEquityFromFills(eventsQuery.data, row?.capital_paise),
    [eventsQuery.data, row?.capital_paise],
  );

  const eventsError =
    eventsQuery.error instanceof ApiError
      ? eventsQuery.error.message
      : eventsQuery.isError
        ? "Failed to load events"
        : null;

  return (
    <PageShell
      title={row ? `${row.ticker} · ${row.strategy}` : `Backtest #${backtestId}`}
      subtitle="Manual backtest result after transaction costs."
      actions={
        <Link
          to={`/workbooks/${workbookId}?tab=backtests`}
          className="text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        >
          ← Workbook
        </Link>
      }
    >
      {detailQuery.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
      ) : detailQuery.isError ? (
        <EmptyState
          title="Backtest not found"
          body={
            detailQuery.error instanceof ApiError
              ? detailQuery.error.message
              : "Could not load this backtest."
          }
        />
      ) : row ? (
        <div className="space-y-6">
          <ActivityResultHeader
            subtitle={`Backtest #${row.id} · ${row.status}`}
            returnPct={resolveReturnPct(row)}
            pnlPaise={row.pnl_paise}
            feesPaise={row.fees_paise}
            capitalPaise={row.capital_paise}
          />

          <Panel title="Details">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Ending equity" value={formatPaise(row.ending_equity_paise)} />
              <Stat label="Max drawdown" value={formatPaise(row.max_drawdown_paise)} />
              <Stat label="Fills" value={String(row.fills)} />
              <Stat label="Bars" value={String(row.bars)} />
              <Stat label="From" value={formatNs(row.from_ns)} />
              <Stat label="To" value={formatNs(row.to_ns)} />
              <Stat label="Created" value={row.created_at || "—"} />
              <Stat label="Return (bp)" value={String(row.return_pct_bp)} />
            </div>
          </Panel>

          <Panel title="Daily value">
            <DailyValueTable
              rows={dailyRows}
              selectedDay={focusDay}
              onSelectDay={(day) => {
                setFocusDay(day);
                setFocusSeq((n) => n + 1);
                setShowGraph(true);
              }}
            />
          </Panel>

          <Panel
            title="Events"
            action={
              <EventGraphToggle
                open={showGraph}
                disabled={!span}
                onToggle={() => setShowGraph((v) => !v)}
              />
            }
          >
            {showGraph && span ? (
              <EventPriceChart
                ticker={row.ticker}
                fromNs={span.fromNs}
                toNs={span.toNs}
                events={eventsQuery.data ?? []}
                focusDay={focusDay}
                focusSeq={focusSeq}
              />
            ) : null}
            <EventTimeline
              events={eventsQuery.data}
              loading={eventsQuery.isLoading}
              error={eventsError}
              layerOptions={BACKTEST_LAYERS}
            />
          </Panel>
        </div>
      ) : null}
    </PageShell>
  );
}
