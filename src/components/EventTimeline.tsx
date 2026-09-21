import { useMemo, useState } from "react";
import { formatNs, formatPaise } from "@/lib/format";
import type { RunEvent, RunEventLayer } from "@/types/api";
import { EmptyState } from "@/components/ui";

const LAYERS: { id: RunEventLayer; label: string }[] = [
  { id: "signal", label: "Signals" },
  { id: "rejection", label: "Rejections" },
  { id: "fill", label: "Fills" },
  { id: "routing", label: "Routing" },
  { id: "lifecycle", label: "Lifecycle" },
];

const ALL_ON: Record<RunEventLayer, boolean> = {
  signal: true,
  rejection: true,
  fill: true,
  routing: true,
  lifecycle: true,
};

export function EventTimeline({
  events,
  loading,
  error,
}: {
  events: RunEvent[] | undefined;
  loading?: boolean;
  error?: string | null;
}) {
  const [layers, setLayers] = useState(ALL_ON);

  const visible = useMemo(() => {
    if (!events) {
      return [];
    }
    return events.filter((e) => layers[e.type]);
  }, [events, layers]);

  const counts = useMemo(() => {
    const c: Record<RunEventLayer, number> = {
      signal: 0,
      rejection: 0,
      fill: 0,
      routing: 0,
      lifecycle: 0,
    };
    for (const e of events ?? []) {
      c[e.type] += 1;
    }
    return c;
  }, [events]);

  function toggle(id: RunEventLayer) {
    setLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Loading events…</p>;
  }

  if (error) {
    return <p className="text-sm text-[var(--color-danger)]">{error}</p>;
  }

  if (!events?.length) {
    return (
      <EmptyState
        title="No events recorded"
        body="This run left no signals, rejections, fills, routing, or lifecycle rows."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {LAYERS.map(({ id, label }) => {
          const on = layers[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={[
                "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                on
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                  : "border-[var(--color-line)] text-[var(--color-ink-muted)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]",
              ].join(" ")}
            >
              {label}
              <span className="ml-1.5 font-mono opacity-70">{counts[id]}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState title="Nothing in these layers" body="Turn on another layer above." />
      ) : (
        <ol className="max-h-[28rem] space-y-0 overflow-y-auto border-l border-[var(--color-line)] pl-4">
          {visible.map((ev) => (
            <li key={`${ev.type}-${ev.id}`} className="relative pb-4 last:pb-0">
              <span
                className="absolute top-1.5 -left-[1.2rem] h-2 w-2 rounded-full bg-[var(--color-accent)]"
                aria-hidden
              />
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-mono text-[10px] tracking-wide text-[var(--color-ink-muted)] uppercase">
                  {ev.type}
                </span>
                <span className="font-mono text-[10px] text-[var(--color-ink-muted)]">
                  {formatNs(ev.timestamp_ns)}
                </span>
              </div>
              <p className="mt-0.5 text-sm leading-snug text-[var(--color-ink)]">{summarize(ev)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function summarize(ev: RunEvent): string {
  switch (ev.type) {
    case "signal":
      return `${ev.data.ticker} · ${ev.data.strategy} · ${ev.data.intent_count} intent${ev.data.intent_count === 1 ? "" : "s"}`;
    case "rejection":
      return `${ev.data.ticker} · ${ev.data.rule}: ${ev.data.reason}`;
    case "fill":
      return `${ev.data.ticker} · ${ev.data.side} ${ev.data.qty} @ ${formatPaise(ev.data.price_paise)} (fees ${formatPaise(ev.data.fees_paise)})`;
    case "routing":
      return `${ev.data.ticker} · ${ev.data.strategy} · ${ev.data.decision}${ev.data.reason ? ` — ${ev.data.reason}` : ""}`;
    case "lifecycle":
      return `${ev.data.ticker} · ${ev.data.event_type}${ev.data.detail ? ` — ${ev.data.detail}` : ""}`;
  }
}
