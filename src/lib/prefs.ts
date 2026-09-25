/** Browser-local JSON prefs (survive restarts). Each calendar/group uses its own key. */

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

/** One key per independent calendar / date-control group. */
export const PrefKeys = {
  chartRange: "algocraft.prefs.chart_range",
  backtestDates: "algocraft.prefs.backtest_dates",
  historyFilter: "algocraft.prefs.history_filter",
  routingRun: "algocraft.prefs.routing_run",
} as const;
