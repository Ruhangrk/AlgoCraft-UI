const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

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
    Date.UTC(y, mo - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, 0) - IST_OFFSET_MS;
  return utcMs * 1_000_000;
}

/** IST wall-clock ns for YYYY-MM-DD + HH:MM (seconds = 0, or 59 if endOfMinute). */
export function istDateTimeToNs(ymd: string, hm: string, endOfMinute = false): number {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  const tm = /^(\d{2}):(\d{2})$/.exec(hm.trim());
  if (!dm || !tm) {
    throw new Error("expected YYYY-MM-DD and HH:MM");
  }
  const utcMs =
    Date.UTC(
      Number(dm[1]),
      Number(dm[2]) - 1,
      Number(dm[3]),
      Number(tm[1]),
      Number(tm[2]),
      endOfMinute ? 59 : 0,
      endOfMinute ? 999 : 0,
    ) - IST_OFFSET_MS;
  return utcMs * 1_000_000;
}

export function shiftYmd(ymd: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) {
    return ymd;
  }
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + deltaDays);
  const d = new Date(utc);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function calendarDaysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) {
    return 0;
  }
  return Math.floor((b - a) / 86_400_000) + 1;
}

export function formatReturnPct(returnPct: number): string {
  const sign = returnPct > 0 ? "+" : "";
  return `${sign}${returnPct.toFixed(2)}%`;
}
