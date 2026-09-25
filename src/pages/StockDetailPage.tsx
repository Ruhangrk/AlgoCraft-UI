import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { CandleChart } from "@/components/CandleChart";
import { InstrumentSearch } from "@/components/InstrumentSearch";
import { EmptyState, Field, PageShell, Panel, Stat, TextInput } from "@/components/ui";
import { PrefKeys, loadJson, saveJson } from "@/lib/prefs";
import {
  calendarDaysInclusive,
  istDateTimeToNs,
  shiftYmd,
} from "@/lib/time";
import { ApiError, type ChartResolution, type OhlcvCandle } from "@/types/api";

const TF_OPTIONS: { id: ChartResolution; label: string }[] = [
  { id: "1m", label: "1 min" },
  { id: "1d", label: "Daily" },
  { id: "1w", label: "Weekly" },
  { id: "1M", label: "Monthly" },
];

/** Cap for 1m OHLCV windows (calendar days inclusive). */
const MAX_1M_DAYS = 3;
const DEFAULT_FROM_TIME = "00:00";
const DEFAULT_TO_TIME = "23:59";

type ChartRangePref = {
  resolution: ChartResolution;
  from: string;
  to: string;
  fromTime: string;
  toTime: string;
};

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

function readChartPref(): ChartRangePref | null {
  const parsed = loadJson<ChartRangePref>(PrefKeys.chartRange);
  if (!parsed?.from || !parsed?.to || !parsed?.resolution) {
    return null;
  }
  return {
    resolution: parsed.resolution,
    from: parsed.from,
    to: parsed.to,
    fromTime: parsed.fromTime || DEFAULT_FROM_TIME,
    toTime: parsed.toTime || DEFAULT_TO_TIME,
  };
}

function filterCandlesByIstWindow(
  candles: OhlcvCandle[],
  from: string,
  fromTime: string,
  to: string,
  toTime: string,
): OhlcvCandle[] {
  let startNs: number;
  let endNs: number;
  try {
    startNs = istDateTimeToNs(from, fromTime, false);
    endNs = istDateTimeToNs(to, toTime, true);
  } catch {
    return candles;
  }
  if (endNs < startNs) {
    return [];
  }
  return candles.filter((c) => c.timestamp_ns >= startNs && c.timestamp_ns <= endNs);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function StockDetailPage() {
  const { ticker = "" } = useParams();
  const navigate = useNavigate();
  const symbol = ticker.toUpperCase();

  const cached = useMemo(() => readChartPref(), []);

  const [resolution, setResolution] = useState<ChartResolution>(
    () => cached?.resolution ?? "1d",
  );
  const [from, setFrom] = useState(() => cached?.from ?? monthsAgoYmd(8));
  const [to, setTo] = useState(() => cached?.to ?? todayYmd());
  const [fromTime, setFromTime] = useState(() => cached?.fromTime ?? DEFAULT_FROM_TIME);
  const [toTime, setToTime] = useState(() => cached?.toTime ?? DEFAULT_TO_TIME);

  useEffect(() => {
    saveJson(PrefKeys.chartRange, { resolution, from, to, fromTime, toTime });
  }, [resolution, from, to, fromTime, toTime]);

  function selectResolution(next: ChartResolution) {
    setResolution(next);
    if (next === "1m") {
      const end = todayYmd();
      setTo(end);
      setFrom((prev) =>
        calendarDaysInclusive(prev, end) > MAX_1M_DAYS ? daysAgoYmd(2) : prev,
      );
      setFromTime(DEFAULT_FROM_TIME);
      setToTime(DEFAULT_TO_TIME);
    }
  }

  function shiftWindow(deltaDays: number) {
    const nextFrom = shiftYmd(from, deltaDays);
    const nextTo = shiftYmd(to, deltaDays);
    if (resolution === "1m" && calendarDaysInclusive(nextFrom, nextTo) > MAX_1M_DAYS) {
      return;
    }
    setFrom(nextFrom);
    setTo(nextTo);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const nextFrom = shiftYmd(from, -1);
        const nextTo = shiftYmd(to, -1);
        if (resolution === "1m" && calendarDaysInclusive(nextFrom, nextTo) > MAX_1M_DAYS) {
          return;
        }
        setFrom(nextFrom);
        setTo(nextTo);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextFrom = shiftYmd(from, 1);
        const nextTo = shiftYmd(to, 1);
        if (resolution === "1m" && calendarDaysInclusive(nextFrom, nextTo) > MAX_1M_DAYS) {
          return;
        }
        setFrom(nextFrom);
        setTo(nextTo);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [from, to, resolution]);

  const rangeTooWideFor1m =
    resolution === "1m" && calendarDaysInclusive(from, to) > MAX_1M_DAYS;

  // Date-only key → changing time does not refetch; TanStack keeps day candles cached.
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

  const visibleCandles = useMemo(() => {
    const raw = ohlcvQuery.data?.candles ?? [];
    if (!raw.length) {
      return raw;
    }
    if (fromTime === DEFAULT_FROM_TIME && toTime === DEFAULT_TO_TIME) {
      return raw;
    }
    return filterCandlesByIstWindow(raw, from, fromTime, to, toTime);
  }, [ohlcvQuery.data, from, fromTime, to, toTime]);

  const lastClose = useMemo(() => {
    if (!visibleCandles.length) {
      return null;
    }
    return visibleCandles[visibleCandles.length - 1].close_paise / 100;
  }, [visibleCandles]);

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
        <Panel title="Switch stock">
          <InstrumentSearch
            placeholder="Popular list or type any ticker…"
            onSelect={(inst) => {
              if (inst.ticker !== symbol) {
                navigate(`/markets/${inst.ticker}`);
              }
            }}
          />
        </Panel>

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
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <button
              type="button"
              title="Shift range back one day (←)"
              aria-label="Previous day"
              className="rounded-md border border-[var(--color-line)] px-2.5 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper)]"
              onClick={() => shiftWindow(-1)}
            >
              ←
            </button>

            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="From date">
                <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="From time" hint="IST · default start of day">
                <TextInput
                  type="time"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value || DEFAULT_FROM_TIME)}
                />
              </Field>
              <Field label="To date">
                <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
              <Field label="To time" hint="IST · default end of day">
                <TextInput
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value || DEFAULT_TO_TIME)}
                />
              </Field>
            </div>

            <button
              type="button"
              title="Shift range forward one day (→)"
              aria-label="Next day"
              className="rounded-md border border-[var(--color-line)] px-2.5 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper)]"
              onClick={() => shiftWindow(1)}
            >
              →
            </button>
          </div>

          <p className="mb-3 text-xs text-[var(--color-ink-muted)]">
            Range is remembered for this session. Day candles stay in TanStack Query cache; time
            filters apply instantly. Use ← → (or arrow keys when not typing) to nudge both dates.
            {resolution === "1m"
              ? ` 1-min window max ${MAX_1M_DAYS} calendar days.`
              : null}
          </p>

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
          ) : visibleCandles.length === 0 ? (
            <EmptyState
              title="No candles in range"
              body={
                (ohlcvQuery.data?.candles.length ?? 0) > 0
                  ? "Bars exist for these dates but none fall inside the From/To times. Widen the times or reset to 00:00–23:59."
                  : "Try a different date range or resolution. Data comes from AlgoCraft cache / vendor."
              }
            />
          ) : (
            <>
              <CandleChart candles={visibleCandles} intraday={resolution === "1m"} />
              <p className="mt-2 font-mono text-[10px] text-[var(--color-ink-muted)]">
                {visibleCandles.length}
                {(ohlcvQuery.data?.candles.length ?? 0) !== visibleCandles.length
                  ? ` / ${ohlcvQuery.data!.candles.length}`
                  : ""}{" "}
                bars · {resolution} · {from} {fromTime} → {to} {toTime} IST · vendor_fetches=
                {ohlcvQuery.data!.vendor_fetches}
              </p>
            </>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}
