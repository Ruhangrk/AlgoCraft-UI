import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { OhlcvCandle } from "@/types/api";

function toChartRows(candles: OhlcvCandle[]) {
  return candles
    .map((c) => ({
      time: Math.floor(c.timestamp_ns / 1_000_000_000) as UTCTimestamp,
      open: c.open_paise / 100,
      high: c.high_paise / 100,
      low: c.low_paise / 100,
      close: c.close_paise / 100,
    }))
    .sort((a, b) => Number(a.time) - Number(b.time));
}

export function CandleChart({
  candles,
  height = 420,
  intraday = false,
}: {
  candles: OhlcvCandle[];
  height?: number;
  /** Show clock time on the axis (for 1m bars). */
  intraday?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) {
      return;
    }

    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#5c6b7a",
        fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "#eef1f4" },
        horzLines: { color: "#eef1f4" },
      },
      rightPriceScale: { borderColor: "#d5dce5" },
      timeScale: {
        borderColor: "#d5dce5",
        timeVisible: intraday,
        secondsVisible: false,
      },
      crosshair: { mode: 1 },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#0b6e4f",
      downColor: "#b42318",
      borderUpColor: "#0b6e4f",
      borderDownColor: "#b42318",
      wickUpColor: "#0b6e4f",
      wickDownColor: "#b42318",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (hostRef.current) {
        chart.applyOptions({ width: hostRef.current.clientWidth });
      }
    });
    ro.observe(el);
    chart.applyOptions({ width: el.clientWidth });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height, intraday]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) {
      return;
    }
    const rows = toChartRows(candles);
    series.setData(rows);
    if (rows.length) {
      chart.timeScale().fitContent();
    }
  }, [candles]);

  return <div ref={hostRef} className="w-full overflow-hidden rounded-lg" style={{ height }} />;
}
