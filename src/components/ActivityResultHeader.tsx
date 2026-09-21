import { formatPaise } from "@/lib/format";
import { formatReturnPct } from "@/lib/time";

export function ActivityResultHeader({
  returnPct,
  pnlPaise,
  feesPaise,
  capitalPaise,
  subtitle,
}: {
  returnPct: number;
  pnlPaise: number;
  feesPaise: number;
  capitalPaise: number;
  subtitle?: string;
}) {
  const positive = returnPct >= 0;
  const color = positive ? "var(--color-gain)" : "var(--color-loss)";

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-6">
      {subtitle ? (
        <p className="mb-2 text-xs font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
          {subtitle}
        </p>
      ) : null}
      <p className="font-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl" style={{ color }}>
        {formatReturnPct(returnPct)}
      </p>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">Return after all costs</p>
      <div className="mt-4 grid gap-3 border-t border-[var(--color-line)] pt-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] tracking-wide text-[var(--color-ink-muted)] uppercase">P&amp;L</p>
          <p className="mt-0.5 font-mono text-sm tabular-nums" style={{ color }}>
            {formatPaise(pnlPaise)}
          </p>
        </div>
        <div>
          <p className="text-[10px] tracking-wide text-[var(--color-ink-muted)] uppercase">Fees</p>
          <p className="mt-0.5 font-mono text-sm tabular-nums">{formatPaise(feesPaise)}</p>
        </div>
        <div>
          <p className="text-[10px] tracking-wide text-[var(--color-ink-muted)] uppercase">Capital</p>
          <p className="mt-0.5 font-mono text-sm tabular-nums">{formatPaise(capitalPaise)}</p>
        </div>
      </div>
    </div>
  );
}
