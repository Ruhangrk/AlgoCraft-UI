/** Convert YYYY-MM-DD calendar date in IST to epoch nanoseconds. */
export function istDateToNs(ymd: string, endOfDay: boolean): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) {
    throw new Error("date must be YYYY-MM-DD");
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // Midnight/eod IST = that civil time minus 5h30 from a UTC calendar clock.
  const utcMs =
    Date.UTC(y, mo - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, 0) -
    (5 * 60 + 30) * 60 * 1000;
  return utcMs * 1_000_000;
}

export function formatReturnPct(returnPct: number): string {
  const sign = returnPct > 0 ? "+" : "";
  return `${sign}${returnPct.toFixed(2)}%`;
}
