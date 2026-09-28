/** Browser-local JSON prefs (survive restarts). */

export function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function clearJson(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Global prefs (not tied to a workbook). */
export const PrefKeys = {
  chartRange: "algocraft.prefs.chart_range",
  /** @deprecated prefer workbookForm(wid) — kept for one-time migrate */
  backtestDates: "algocraft.prefs.backtest_dates",
  /** @deprecated prefer historyFilter(wid) */
  historyFilter: "algocraft.prefs.history_filter",
  /** @deprecated prefer workbookForm(wid) */
  routingRun: "algocraft.prefs.routing_run",
} as const;

/** All workbook page form blanks — one blob per workbook id. */
export function workbookFormKey(workbookId: number): string {
  return `algocraft.prefs.workbook.${workbookId}.form`;
}

/** History from/to filter — per workbook. */
export function historyFilterKey(workbookId: number): string {
  return `algocraft.prefs.workbook.${workbookId}.history`;
}

export type WorkbookFormPrefs = {
  capitalRupees?: string;
  router?: string;
  anchorDate?: string;
  btTicker?: string;
  btStrategy?: string;
  btFrom?: string;
  btTo?: string;
  btCapital?: string;
  rechargeRupees?: string;
  fillTicker?: string;
  fillSide?: "all" | "buy" | "sell";
};
