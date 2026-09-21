import { Link, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { CandleChart } from "@/components/CandleChart";
import { EmptyState, Field, PageShell, Panel, Stat, TextInput } from "@/components/ui";
import { ApiError, type ChartResolution } from "@/types/api";

const TF_OPTIONS: { id: ChartResolution; label: string }[] = [
  { id: "1m", label: "1 min" },
  { id: "1d", label: "Daily" },
  { id: "1w", label: "Weekly" },
  { id: "1M", label: "Monthly" },
];

/** Chart + API cap for 1m OHLCV windows. */
const MAX_1M_DAYS = 3;
/** Inclusive window when switching to 1m: today and N prior calendar days. */
const DEFAULT_1M_LOOKBACK = 2;

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgoYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthsAgoYmd(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function calendarDaysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) {
    return 0;
  }
  return Math.floor((b - a) / 86_400_000) + 1;
}

export function StockDetailPage() {
  const { ticker = "" } = useParams();
  const navigate = useNavigate();
  const symbol = ticker.toUpperCase();

  const [resolution, setResolution] = useState<ChartResolution>("1d");
  const [from, setFrom] = useState(() => monthsAgoYmd(8));
  const [to, setTo] = useState(() => todayYmd());

  function selectResolution(next: ChartResolution) {
    setResolution(next);
    if (next === "1m") {
      setTo(todayYmd());
      setFrom((prev) => {
        const end = todayYmd();
        if (calendarDaysInclusive(prev, end) > MAX_1M_DAYS) {
          return daysAgoYmd(DEFAULT_1M_LOOKBACK);
        }
        return prev;
      });
    }
  }

  const rangeTooWideFor1m =
    resolution === "1m" && calendarDaysInclusive(from, to) > MAX_1M_DAYS;

  const ohlcvQuery = useQuery({
    queryKey: ["ohlcv", symbol, resolution, from, to],
    queryFn: () => api.getOhlcv(symbol, resolution, from, to),
    enabled: Boolean(symbol) && Boolean(from) && Boolean(to) && !rangeTooWideFor1m,
    staleTime: resolution === "1m" ? 60_000 : 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const detailQuery = useQuery({
    queryKey: ["instruments", "detail", symbol],
    queryFn: () => api.getInstrument(symbol),
    enabled: Boolean(symbol),
    staleTime: 5 * 60_000,
    retry: (count, err) => {
      if (err instanceof ApiError && err.status === 404) {
        return false;
      }
      return count < 1;
    },
  });

  const lastClose = useMemo(() => {
    const c = ohlcvQuery.data?.candles;
    if (!c?.length) {
      return null;
    }
    return c[c.length - 1].close_paise / 100;
  }, [ohlcvQuery.data]);

  const inst = detailQuery.data;
  const title = inst?.ticker ?? symbol;

  return (
    <PageShell
      title={title}
      subtitle={inst?.name ?? "Instrument detail"}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/markets"
            className="text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            ← Markets
          </Link>
          {inst ? (
            <button
              type="button"
              className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
              onClick={() => {
                sessionStorage.setItem("algocraft_prefill_ticker", inst.ticker);
                navigate("/workbooks");
              }}
            >
              Use in workbook
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        <Panel title="Instrument">
          {detailQuery.isLoading ? (
            <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
          ) : detailQuery.isError ? (
            <EmptyState
              title="Instrument not found"
              body={
                detailQuery.error instanceof ApiError
                  ? detailQuery.error.message
                  : "Could not load this ticker from the catalog."
              }
            />
          ) : inst ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Exchange" value={`${inst.exchange} ${inst.segment}`} />
              <Stat label="Lot size" value={String(inst.lot_size)} />
              <Stat label="Tick" value={`₹${(inst.tick_size_paise / 100).toFixed(2)}`} />
              <Stat label="ISIN" value={inst.isin || "—"} />
              <Stat
                label="Last close"
                value={lastClose != null ? `₹${lastClose.toLocaleString("en-IN")}` : "—"}
              />
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Price"
          action={
            <div className="flex flex-wrap items-center gap-1">
              {TF_OPTIONS.map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => selectResolution(tf.id)}
                  className={[
                    "rounded-md px-2.5 py-1 text-xs font-medium transition",
                    resolution === tf.id
                      ? "bg-[var(--color-ink)] text-white"
                      : "text-[var(--color-ink-muted)] hover:bg-[var(--color-paper)]",
                  ].join(" ")}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Field label="From">
              <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          {resolution === "1m" ? (
            <p className="mb-3 text-xs text-[var(--color-ink-muted)]">
              1-minute charts load at most {MAX_1M_DAYS} calendar days at a time.
            </p>
          ) : null}

          {rangeTooWideFor1m ? (
            <EmptyState
              title="Range too wide for 1 min"
              body={`Narrow From/To to at most ${MAX_1M_DAYS} calendar days, or switch to Daily.`}
            />
          ) : ohlcvQuery.isLoading ? (
            <p className="py-16 text-center text-sm text-[var(--color-ink-muted)]">Loading chart…</p>
          ) : ohlcvQuery.isError ? (
            <EmptyState
              title="Could not load OHLCV"
              body={
                ohlcvQuery.error instanceof ApiError
                  ? ohlcvQuery.error.message
                  : "Chart request failed."
              }
            />
          ) : (ohlcvQuery.data?.candles.length ?? 0) === 0 ? (
            <EmptyState
              title="No candles in range"
              body="Try a different date range or resolution. Data comes from AlgoCraft cache / vendor."
            />
          ) : (
            <>
              <CandleChart candles={ohlcvQuery.data!.candles} intraday={resolution === "1m"} />
              <p className="mt-2 font-mono text-[10px] text-[var(--color-ink-muted)]">
                {ohlcvQuery.data!.candles.length} bars · {resolution} · vendor_fetches=
                {ohlcvQuery.data!.vendor_fetches} · cached via TanStack Query
              </p>
            </>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}
