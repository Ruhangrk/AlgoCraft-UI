import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { CandleChart, type CandleMarker } from "@/components/CandleChart";
import { Button, Field, TextInput } from "@/components/ui";
import {
  calendarDaysInclusive,
  istDateTimeToNs,
  nsToIstYmd,
  shiftYmd,
} from "@/lib/time";
import { ApiError, type OhlcvCandle, type RunEvent } from "@/types/api";
import type { UTCTimestamp } from "lightweight-charts";

/** Same cap as Markets 1m chart — inclusive calendar days per view. */
const MAX_1M_DAYS = 3;
const DEFAULT_FROM_TIME = "00:00";
const DEFAULT_TO_TIME = "23:59";

type LayerKey = "fill" | "signal" | "rejection" | "lifecycle" | "routing";

function initialWindow(boundFrom: string, boundTo: string): { from: string; to: string } {
  const span = calendarDaysInclusive(boundFrom, boundTo);
  if (span <= MAX_1M_DAYS) {
    return { from: boundFrom, to: boundTo };
  }
  return {
    from: boundFrom,
    to: shiftYmd(boundFrom, MAX_1M_DAYS - 1),
  };
}

/** Enforce max 3 inclusive days; if from > to, collapse to from. */
function fitMaxDays(from: string, to: string): { from: string; to: string } {
  if (!from || !to) {
    return { from, to };
  }
  if (from > to) {
    return { from, to: from };
  }
  if (calendarDaysInclusive(from, to) > MAX_1M_DAYS) {
    return { from, to: shiftYmd(from, MAX_1M_DAYS - 1) };
  }
  return { from, to };
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

function snapToBarTime(sec: number, barTimes: number[]): number | null {
  if (barTimes.length === 0) {
    return null;
  }
  let lo = 0;
  let hi = barTimes.length - 1;
  if (sec < barTimes[0]) {
    return null;
  }
  if (sec > barTimes[hi] + 60) {
    return null;
  }
  if (sec >= barTimes[hi]) {
    return barTimes[hi];
  }
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (barTimes[mid] === sec) {
      return barTimes[mid];
    }
    if (barTimes[mid] < sec) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return barTimes[Math.max(0, hi)];
}

function normalizeFillSide(side: string): "buy" | "sell" | "other" {
  const s = side.toUpperCase();
  if (s === "BUY" || s === "B" || s === "LONG") {
    return "buy";
  }
  if (s === "SELL" || s === "S" || s === "SHORT") {
    return "sell";
  }
  return "other";
}

function eventsToMarkers(
  events: RunEvent[],
  barTimes: number[],
  layers: Record<LayerKey, boolean>,
  ticker: string,
  startNs: number,
  endNs: number,
): CandleMarker[] {
  const markers: CandleMarker[] = [];
  for (const ev of events) {
    if (!layers[ev.type as LayerKey]) {
      continue;
    }
    const evTicker = ev.data.ticker;
    if (evTicker && evTicker !== ticker) {
      continue;
    }
    if (ev.timestamp_ns < startNs || ev.timestamp_ns > endNs) {
      continue;
    }
    const sec = Math.floor(ev.timestamp_ns / 1_000_000_000);
    const snapped = snapToBarTime(sec, barTimes);
    if (snapped == null) {
      continue;
    }
    const time = snapped as UTCTimestamp;

    switch (ev.type) {
      case "fill": {
        const side = normalizeFillSide(String(ev.data.side ?? ""));
        if (side === "buy") {
          markers.push({
            time,
            position: "belowBar",
            shape: "arrowUp",
            color: "#0b6e4f",
            text: "B",
          });
        } else if (side === "sell") {
          markers.push({
            time,
            position: "aboveBar",
            shape: "arrowDown",
            color: "#b42318",
            text: "S",
          });
        } else {
          markers.push({
            time,
            position: "inBar",
            shape: "circle",
            color: "#5c6b7a",
            text: "F",
          });
        }
        break;
      }
      case "signal":
        markers.push({
          time,
          position: "aboveBar",
          shape: "circle",
          color: "#1d4ed8",
          text: "●",
        });
        break;
      case "rejection":
        markers.push({
          time,
          position: "aboveBar",
          shape: "square",
          color: "#a16207",
          text: "✕",
        });
        break;
      case "lifecycle":
        markers.push({
          time,
          position: "belowBar",
          shape: "square",
          color: "#64748b",
          text: "L",
        });
        break;
      case "routing":
        markers.push({
          time,
          position: "belowBar",
          shape: "circle",
          color: "#7c3aed",
          text: "R",
        });
        break;
    }
  }
  return markers.sort((a, b) => Number(a.time) - Number(b.time));
}

/** Min/max event timestamps, or null if empty. */
export function eventSpanNs(events: RunEvent[] | undefined): { fromNs: number; toNs: number } | null {
  if (!events?.length) {
    return null;
  }
  let fromNs = events[0].timestamp_ns;
  let toNs = events[0].timestamp_ns;
  for (const e of events) {
    if (e.timestamp_ns < fromNs) {
      fromNs = e.timestamp_ns;
    }
    if (e.timestamp_ns > toNs) {
      toNs = e.timestamp_ns;
    }
  }
  return { fromNs, toNs };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function EventPriceChart({
  ticker,
  fromNs,
  toNs,
  events,
  /** When set to YYYY-MM-DD, jump view to that full IST day (00:00–23:59). */
  focusDay = null,
  /** Bump to re-apply the same focusDay after the user changed the pickers. */
  focusSeq = 0,
}: {
  ticker: string;
  fromNs: number;
  toNs: number;
  events: RunEvent[];
  focusDay?: string | null;
  focusSeq?: number;
}) {
  const boundFrom = nsToIstYmd(fromNs);
  const boundTo = nsToIstYmd(toNs);

  const [viewFrom, setViewFrom] = useState(() => initialWindow(boundFrom, boundTo).from);
  const [viewTo, setViewTo] = useState(() => initialWindow(boundFrom, boundTo).to);
  const [fromTime, setFromTime] = useState(DEFAULT_FROM_TIME);
  const [toTime, setToTime] = useState(DEFAULT_TO_TIME);

  useEffect(() => {
    const w = initialWindow(boundFrom, boundTo);
    setViewFrom(w.from);
    setViewTo(w.to);
    setFromTime(DEFAULT_FROM_TIME);
    setToTime(DEFAULT_TO_TIME);
  }, [boundFrom, boundTo, ticker]);

  useEffect(() => {
    if (!focusDay || !/^\d{4}-\d{2}-\d{2}$/.test(focusDay)) {
      return;
    }
    setViewFrom(focusDay);
    setViewTo(focusDay);
    setFromTime(DEFAULT_FROM_TIME);
    setToTime(DEFAULT_TO_TIME);
  }, [focusDay, focusSeq]);

  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    fill: true,
    signal: true,
    rejection: true,
    lifecycle: false,
    routing: false,
  });

  function setFromDate(next: string) {
    const fitted = fitMaxDays(next, viewTo < next ? next : viewTo);
    setViewFrom(fitted.from);
    setViewTo(fitted.to);
  }

  function setToDate(next: string) {
    const fitted = fitMaxDays(viewFrom > next ? next : viewFrom, next);
    setViewFrom(fitted.from);
    setViewTo(fitted.to);
  }

  function shiftWindow(deltaDays: number) {
    const fitted = fitMaxDays(shiftYmd(viewFrom, deltaDays), shiftYmd(viewTo, deltaDays));
    setViewFrom(fitted.from);
    setViewTo(fitted.to);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        shiftWindow(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        shiftWindow(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const rangeOk = calendarDaysInclusive(viewFrom, viewTo) <= MAX_1M_DAYS;

  const ohlcvQuery = useQuery({
    queryKey: ["event-ohlcv", ticker, "1m", viewFrom, viewTo],
    queryFn: () => api.getOhlcv(ticker, "1m", viewFrom, viewTo),
    enabled: Boolean(ticker) && Boolean(viewFrom) && Boolean(viewTo) && rangeOk,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const visibleCandles = useMemo(() => {
    const raw = ohlcvQuery.data?.candles ?? [];
    if (!raw.length) {
      return raw;
    }
    if (fromTime === DEFAULT_FROM_TIME && toTime === DEFAULT_TO_TIME) {
      return raw;
    }
    return filterCandlesByIstWindow(raw, viewFrom, fromTime, viewTo, toTime);
  }, [ohlcvQuery.data, viewFrom, fromTime, viewTo, toTime]);

  const windowNs = useMemo(() => {
    try {
      return {
        start: istDateTimeToNs(viewFrom, fromTime, false),
        end: istDateTimeToNs(viewTo, toTime, true),
      };
    } catch {
      return { start: fromNs, end: toNs };
    }
  }, [viewFrom, fromTime, viewTo, toTime, fromNs, toNs]);

  const barTimes = useMemo(
    () => visibleCandles.map((c) => Math.floor(c.timestamp_ns / 1_000_000_000)),
    [visibleCandles],
  );

  const markers = useMemo(
    () =>
      eventsToMarkers(events, barTimes, layers, ticker, windowNs.start, windowNs.end),
    [events, barTimes, layers, ticker, windowNs],
  );

  function toggle(key: LayerKey) {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="mb-5 space-y-3 border-b border-[var(--color-line)] pb-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
            Price + events · {ticker} · 1m
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-[var(--color-ink-muted)]">
            Activity span {boundFrom} → {boundTo} · view max {MAX_1M_DAYS} days
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["fill", "Fills"],
              ["signal", "Signals"],
              ["rejection", "Rejections"],
              ["lifecycle", "Lifecycle"],
              ["routing", "Routing"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={[
                "rounded-md border px-2 py-0.5 text-[11px] font-medium transition",
                layers[id]
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                  : "border-[var(--color-line)] text-[var(--color-ink-muted)]",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Button
          type="button"
          variant="secondary"
          title="Shift range back one day (←)"
          onClick={() => shiftWindow(-1)}
        >
          ←
        </Button>

        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="From date">
            <TextInput
              type="date"
              value={viewFrom}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </Field>
          <Field label="From time" hint="IST">
            <TextInput
              type="time"
              value={fromTime}
              onChange={(e) => setFromTime(e.target.value || DEFAULT_FROM_TIME)}
            />
          </Field>
          <Field label="To date">
            <TextInput type="date" value={viewTo} onChange={(e) => setToDate(e.target.value)} />
          </Field>
          <Field label="To time" hint="IST">
            <TextInput
              type="time"
              value={toTime}
              onChange={(e) => setToTime(e.target.value || DEFAULT_TO_TIME)}
            />
          </Field>
        </div>

        <Button
          type="button"
          variant="secondary"
          title="Shift range forward one day (→)"
          onClick={() => shiftWindow(1)}
        >
          →
        </Button>
      </div>

      {!rangeOk ? (
        <p className="text-xs text-[var(--color-warn)]">
          1m view is capped at {MAX_1M_DAYS} calendar days — narrow the dates.
        </p>
      ) : (
        <p className="text-[11px] text-[var(--color-ink-muted)]">
          Chart uses your dates/times (IST). ← → nudge both dates. Arrow keys when not typing.
        </p>
      )}

      <div className="flex flex-wrap gap-3 text-[11px] text-[var(--color-ink-muted)]">
        <span>
          <span className="mr-1 inline-block text-[#0b6e4f]">▲</span>Buy fill
        </span>
        <span>
          <span className="mr-1 inline-block text-[#b42318]">▼</span>Sell fill
        </span>
        <span>
          <span className="mr-1 inline-block text-[#1d4ed8]">●</span>Signal
        </span>
        <span>
          <span className="mr-1 inline-block text-[#a16207]">■</span>Rejection
        </span>
      </div>

      {ohlcvQuery.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading candles…</p>
      ) : ohlcvQuery.isError ? (
        <p className="text-sm text-[var(--color-danger)]">
          {ohlcvQuery.error instanceof ApiError
            ? ohlcvQuery.error.message
            : "Could not load OHLCV for this range."}
        </p>
      ) : visibleCandles.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          No 1m candles in this date/time window.
        </p>
      ) : (
        <>
          <CandleChart candles={visibleCandles} markers={markers} height={380} intraday />
          <p className="font-mono text-[10px] text-[var(--color-ink-muted)]">
            {visibleCandles.length} bars · {markers.length} markers ·{" "}
            {viewFrom} {fromTime} → {viewTo} {toTime} IST · vendor_fetches=
            {ohlcvQuery.data?.vendor_fetches ?? 0}
          </p>
        </>
      )}
    </div>
  );
}

export function EventGraphToggle({
  open,
  onToggle,
  disabled,
}: {
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <Button type="button" variant="secondary" disabled={disabled} onClick={onToggle}>
      {open ? "Hide graph" : "Event graph"}
    </Button>
  );
}
