import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { EventTimeline } from "@/components/EventTimeline";
import { formatPaise } from "@/lib/format";
import { ApiError } from "@/types/api";
import { Button, EmptyState, PageShell, Panel, Stat } from "@/components/ui";

/** Run detail — summary + containers + event timeline. */
export function RunDetailPage() {
  const { workbookId = "", runId = "" } = useParams();
  const wid = Number(workbookId);
  const rid = Number(runId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const runsQuery = useQuery({
    queryKey: ["runs", wid],
    queryFn: () => api.listRuns(wid, { limit: 200 }),
    enabled: Number.isFinite(wid) && wid > 0,
  });

  const containersQuery = useQuery({
    queryKey: ["containers", wid],
    queryFn: () => api.listContainers(wid),
    enabled: Number.isFinite(wid) && wid > 0,
  });

  const eventsQuery = useQuery({
    queryKey: ["run-events", wid, rid],
    queryFn: () => api.listRunEvents(wid, rid, "all"),
    enabled: Number.isFinite(wid) && wid > 0 && Number.isFinite(rid) && rid > 0,
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteRun(wid, rid),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["runs", wid] });
      navigate(`/workbooks/${workbookId}?tab=runs`);
    },
  });

  const run = runsQuery.data?.find((r) => r.id === rid);
  const notFound = !runsQuery.isLoading && !runsQuery.isError && !run;

  const eventsError =
    eventsQuery.error instanceof ApiError
      ? eventsQuery.error.message
      : eventsQuery.isError
        ? "Failed to load events"
        : null;

  return (
    <PageShell
      title={run ? `Run #${run.id}` : `Run #${runId}`}
      subtitle="Routing run summary after capital return."
      actions={
        <Link
          to={`/workbooks/${workbookId}?tab=runs`}
          className="text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        >
          ← Workbook
        </Link>
      }
    >
      {runsQuery.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
      ) : runsQuery.isError ? (
        <EmptyState
          title="Could not load run"
          body={
            runsQuery.error instanceof ApiError
              ? runsQuery.error.message
              : "Failed to load workbook runs."
          }
        />
      ) : notFound ? (
        <EmptyState
          title="Run not found"
          body="This id is not in the workbook run list (hidden or never existed)."
        />
      ) : run ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-6">
            <p className="mb-2 text-xs font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
              Run #{run.id} · {run.router}
            </p>
            <p className="font-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              {formatPaise(run.returned_paise)}
            </p>
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">Capital returned to workbook</p>
            <div className="mt-4 grid gap-3 border-t border-[var(--color-line)] pt-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] tracking-wide text-[var(--color-ink-muted)] uppercase">
                  Selected
                </p>
                <p className="mt-0.5 font-mono text-sm tabular-nums">{run.selected}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-wide text-[var(--color-ink-muted)] uppercase">
                  Fills
                </p>
                <p className="mt-0.5 font-mono text-sm tabular-nums">{run.fills}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-wide text-[var(--color-ink-muted)] uppercase">
                  Created
                </p>
                <p className="mt-0.5 font-mono text-sm tabular-nums">{run.created_at || "—"}</p>
              </div>
            </div>
          </div>

          <Panel
            title="Details"
            action={
              <Button
                type="button"
                variant="secondary"
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (!window.confirm(`Hide run #${rid} from history? (soft-delete)`)) {
                    return;
                  }
                  deleteMut.mutate();
                }}
              >
                {deleteMut.isPending ? "Hiding…" : "Hide from history"}
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Router" value={run.router} />
              <Stat label="Selected" value={String(run.selected)} />
              <Stat label="Fills" value={String(run.fills)} />
              <Stat label="Returned" value={formatPaise(run.returned_paise)} />
            </div>
            {deleteMut.isError ? (
              <p className="mt-3 text-sm text-[var(--color-danger)]">
                {deleteMut.error instanceof ApiError
                  ? deleteMut.error.message
                  : "Hide failed"}
              </p>
            ) : null}
          </Panel>

          <Panel title="Containers">
            {(containersQuery.data ?? []).length === 0 ? (
              <EmptyState
                title="No containers"
                body="Containers for this workbook appear after a run."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs tracking-wide text-[var(--color-ink-muted)] uppercase">
                    <tr>
                      <th className="pb-2 font-medium">Id</th>
                      <th className="pb-2 font-medium">Ticker</th>
                      <th className="pb-2 font-medium">Strategy</th>
                      <th className="pb-2 font-medium">Mode</th>
                      <th className="pb-2 font-medium">Fills</th>
                      <th className="pb-2 font-medium">Realized</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]">
                    {containersQuery.data?.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2 font-mono">{c.id}</td>
                        <td className="py-2 font-medium">{c.ticker}</td>
                        <td className="py-2">{c.strategy}</td>
                        <td className="py-2 font-mono text-xs">{c.mode}</td>
                        <td className="py-2 font-mono">{c.fills}</td>
                        <td className="py-2 font-mono">{formatPaise(c.realized_paise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Events">
            <EventTimeline
              events={eventsQuery.data}
              loading={eventsQuery.isLoading}
              error={eventsError}
            />
          </Panel>
        </div>
      ) : null}
    </PageShell>
  );
}
