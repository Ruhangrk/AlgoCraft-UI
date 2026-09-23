import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { EventTimeline } from "@/components/EventTimeline";
import { formatPaise } from "@/lib/format";
import { ApiError, type RunEventLayer } from "@/types/api";
import { EmptyState, PageShell, Panel, Stat } from "@/components/ui";

const CONTAINER_LAYERS: { id: RunEventLayer; label: string }[] = [
  { id: "signal", label: "Signals" },
  { id: "rejection", label: "Rejections" },
  { id: "fill", label: "Fills" },
  { id: "lifecycle", label: "Lifecycle" },
];

/** Container detail — allocation / realized P&L + scoped event timeline. */
export function ContainerDetailPage() {
  const { workbookId = "", containerId = "" } = useParams();
  const wid = Number(workbookId);
  const cid = Number(containerId);

  const detailQuery = useQuery({
    queryKey: ["containers", wid, cid],
    queryFn: () => api.getContainer(wid, cid),
    enabled: Number.isFinite(wid) && wid > 0 && Number.isFinite(cid) && cid > 0,
  });

  const eventsQuery = useQuery({
    queryKey: ["container-events", wid, cid],
    queryFn: () => api.listContainerEvents(wid, cid, "all"),
    enabled: Number.isFinite(wid) && wid > 0 && Number.isFinite(cid) && cid > 0,
  });

  const row = detailQuery.data;
  const realized = row?.realized_paise ?? 0;
  const positive = realized >= 0;
  const pnlColor = positive ? "var(--color-gain)" : "var(--color-loss)";

  const eventsError =
    eventsQuery.error instanceof ApiError
      ? eventsQuery.error.message
      : eventsQuery.isError
        ? "Failed to load events"
        : null;

  const backToRun =
    row?.run_id != null && row.run_id > 0
      ? `/workbooks/${workbookId}/runs/${row.run_id}`
      : null;

  return (
    <PageShell
      title={row ? `${row.ticker} · ${row.strategy}` : `Container #${containerId}`}
      subtitle="Single trading container — allocation, realized P&L, and its events."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {backToRun ? (
            <Link
              to={backToRun}
              className="text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              ← Run #{row?.run_id}
            </Link>
          ) : null}
          <Link
            to={`/workbooks/${workbookId}?tab=runs`}
            className="text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            ← Workbook
          </Link>
        </div>
      }
    >
      {detailQuery.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
      ) : detailQuery.isError ? (
        <EmptyState
          title="Container not found"
          body={
            detailQuery.error instanceof ApiError
              ? detailQuery.error.message
              : "Missing, wrong workbook, or soft-deleted."
          }
        />
      ) : row ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-6">
            <p className="mb-2 text-xs font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
              Container #{row.id}
              {row.run_id != null ? ` · run #${row.run_id}` : ""} · {row.mode}
            </p>
            <p
              className="font-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl"
              style={{ color: pnlColor }}
            >
              {formatPaise(realized)}
            </p>
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">Realized P&amp;L</p>
            <div className="mt-4 grid gap-3 border-t border-[var(--color-line)] pt-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] tracking-wide text-[var(--color-ink-muted)] uppercase">
                  Allocation
                </p>
                <p className="mt-0.5 font-mono text-sm tabular-nums">
                  {row.allocation_paise != null ? formatPaise(row.allocation_paise) : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] tracking-wide text-[var(--color-ink-muted)] uppercase">
                  Fills
                </p>
                <p className="mt-0.5 font-mono text-sm tabular-nums">{row.fills}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-wide text-[var(--color-ink-muted)] uppercase">
                  Created
                </p>
                <p className="mt-0.5 font-mono text-sm tabular-nums">{row.created_at || "—"}</p>
              </div>
            </div>
          </div>

          <Panel title="Details">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Ticker" value={row.ticker} />
              <Stat label="Strategy" value={row.strategy} />
              <Stat label="Mode" value={row.mode} />
              <Stat
                label="Allocation"
                value={
                  row.allocation_paise != null ? formatPaise(row.allocation_paise) : "—"
                }
              />
            </div>
          </Panel>

          <Panel title="Events">
            <EventTimeline
              events={eventsQuery.data}
              loading={eventsQuery.isLoading}
              error={eventsError}
              layerOptions={CONTAINER_LAYERS}
            />
          </Panel>
        </div>
      ) : null}
    </PageShell>
  );
}
