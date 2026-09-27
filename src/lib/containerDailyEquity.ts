import { nsToIstYmd } from "@/lib/time";
import type { RunEvent } from "@/types/api";

export type DailyEquityRow = {
  /** IST calendar day YYYY-MM-DD */
  day: string;
  /** Mark-to-market equity at start of day (paise). */
  start_paise: number;
  /** Mark-to-market equity at end of day (paise). */
  end_paise: number;
  /** end − start (paise). */
  day_pnl_paise: number;
  fills: number;
  /** Shares held after last fill of the day (can be 0). */
  qty_end: number;
};

function fillSide(side: string): "buy" | "sell" | null {
  const s = side.toUpperCase();
  if (s === "BUY" || s === "B" || s === "LONG") {
    return "buy";
  }
  if (s === "SELL" || s === "S" || s === "SHORT") {
    return "sell";
  }
  return null;
}

/**
 * Reconstruct per-day equity from allocation + fill stream.
 * Open inventory is marked at the last trade price seen that day (carry-forward).
 * Not engine MTM — approximate from events we already have.
 */
export function buildDailyEquityFromFills(
  events: RunEvent[] | undefined,
  allocationPaise: number | null | undefined,
): DailyEquityRow[] {
  if (allocationPaise == null || !Number.isFinite(allocationPaise)) {
    return [];
  }

  const fills = (events ?? [])
    .filter((e): e is Extract<RunEvent, { type: "fill" }> => e.type === "fill")
    .slice()
    .sort((a, b) => a.timestamp_ns - b.timestamp_ns || a.id - b.id);

  if (fills.length === 0) {
    return [];
  }

  let cash = allocationPaise;
  let qty = 0;
  let markPaise = 0;

  const byDay = new Map<string, typeof fills>();
  for (const f of fills) {
    const day = nsToIstYmd(f.timestamp_ns);
    const list = byDay.get(day);
    if (list) {
      list.push(f);
    } else {
      byDay.set(day, [f]);
    }
  }

  const days = [...byDay.keys()].sort();
  const rows: DailyEquityRow[] = [];

  for (const day of days) {
    const startEquity = cash + qty * markPaise;
    const dayFills = byDay.get(day)!;
    for (const f of dayFills) {
      const side = fillSide(String(f.data.side ?? ""));
      const px = f.data.price_paise;
      const q = f.data.qty;
      const fees = f.data.fees_paise ?? 0;
      if (side === "buy") {
        cash -= q * px + fees;
        qty += q;
      } else if (side === "sell") {
        cash += q * px - fees;
        qty -= q;
      }
      markPaise = px;
    }
    const endEquity = cash + qty * markPaise;
    rows.push({
      day,
      start_paise: startEquity,
      end_paise: endEquity,
      day_pnl_paise: endEquity - startEquity,
      fills: dayFills.length,
      qty_end: qty,
    });
  }

  return rows;
}
