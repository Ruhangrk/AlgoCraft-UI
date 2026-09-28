import { formatPaise } from "@/lib/format";
import type { DailyEquityRow } from "@/lib/containerDailyEquity";
import { EmptyState } from "@/components/ui";

export function DailyValueTable({
  rows,
  missingCapitalReason,
  selectedDay,
  onSelectDay,
}: {
  rows: DailyEquityRow[];
  /** Shown when capital/allocation is missing so we cannot build rows. */
  missingCapitalReason?: string | null;
  selectedDay?: string | null;
  /** Click a day → open/jump event graph to that full IST day. */
  onSelectDay?: (day: string) => void;
}) {
  if (missingCapitalReason) {
    return (
      <EmptyState title="No starting capital" body={missingCapitalReason} />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No fill days yet"
        body="Daily equity is built from fill events once they exist."
      />
    );
  }

  return (
    <>
      <p className="mb-3 text-xs text-[var(--color-ink-muted)]">
        Reconstructed from starting capital + fills (IST days). Every day in the activity
        span is listed — zero-fill days show ₹0 P&amp;L. Open qty marked at last trade price
        (not engine MTM). Click a day to show that full day on the event graph.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs tracking-wide text-[var(--color-ink-muted)] uppercase">
            <tr>
              <th className="pb-2 font-medium">Day (IST)</th>
              <th className="pb-2 font-medium">Start value</th>
              <th className="pb-2 font-medium">End value</th>
              <th className="pb-2 font-medium">Day P&amp;L</th>
              <th className="pb-2 font-medium">Fills</th>
              <th className="pb-2 font-medium">Qty end</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {rows.map((d) => {
              const gain = d.day_pnl_paise >= 0;
              const selected = selectedDay === d.day;
              return (
                <tr
                  key={d.day}
                  className={[
                    onSelectDay ? "cursor-pointer" : "",
                    selected
                      ? "bg-[var(--color-paper)]"
                      : "hover:bg-[var(--color-paper)]",
                  ].join(" ")}
                  onClick={onSelectDay ? () => onSelectDay(d.day) : undefined}
                  onKeyDown={
                    onSelectDay
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectDay(d.day);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onSelectDay ? 0 : undefined}
                  aria-selected={onSelectDay ? selected : undefined}
                >
                  <td className="py-2 font-mono text-xs font-medium text-[var(--color-accent)]">
                    {d.day}
                  </td>
                  <td className="py-2 font-mono tabular-nums">{formatPaise(d.start_paise)}</td>
                  <td className="py-2 font-mono tabular-nums">{formatPaise(d.end_paise)}</td>
                  <td
                    className="py-2 font-mono tabular-nums"
                    style={{ color: gain ? "var(--color-gain)" : "var(--color-loss)" }}
                  >
                    {formatPaise(d.day_pnl_paise)}
                  </td>
                  <td className="py-2 font-mono">{d.fills}</td>
                  <td className="py-2 font-mono">{d.qty_end}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
