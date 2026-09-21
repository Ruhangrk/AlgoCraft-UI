import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { formatPaise, rupeesToPaise } from "@/lib/format";
import { ApiError } from "@/types/api";
import {
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  PageShell,
  Panel,
  TextInput,
} from "@/components/ui";

const PREFILL_KEY = "algocraft_prefill_ticker";

export function WorkbookListPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("NSE Workspace");
  const [capitalRupees, setCapitalRupees] = useState("100000");
  const [error, setError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<string | null>(null);

  useEffect(() => {
    const t = sessionStorage.getItem(PREFILL_KEY);
    if (t) {
      setPrefill(t.toUpperCase());
    }
  }, []);

  const listQuery = useQuery({
    queryKey: ["workbooks"],
    queryFn: api.listWorkbooks,
    refetchOnWindowFocus: true,
  });

  const createMutation = useMutation({
    mutationFn: () => api.createWorkbook(name.trim(), rupeesToPaise(Number(capitalRupees))),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workbooks"] });
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not create workbook");
    },
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate();
  }

  const workbooks = listQuery.data ?? [];

  return (
    <PageShell
      title="Workbooks"
      subtitle="Isolated capital pools. Open one to launch runs and inspect history."
    >
      {prefill ? (
        <div className="mb-4 rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm">
          Prefill ticker <span className="font-mono font-medium">{prefill}</span> — open a workbook
          to add it to the run launcher.
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel title="New workbook">
          <form className="space-y-3" onSubmit={onCreate}>
            <Field label="Name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Initial capital (₹)" hint="Sent to API as paise.">
              <TextInput
                type="number"
                min={1}
                step={1}
                value={capitalRupees}
                onChange={(e) => setCapitalRupees(e.target.value)}
                required
              />
            </Field>
            <ErrorBanner message={error} />
            <Button type="submit" disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending ? "Creating…" : "Create workbook"}
            </Button>
          </form>
        </Panel>

        <Panel
          title="Your workbooks"
          action={
            <Button
              variant="ghost"
              type="button"
              onClick={() => void listQuery.refetch()}
              disabled={listQuery.isFetching}
            >
              Refresh
            </Button>
          }
        >
          {listQuery.isLoading ? (
            <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
          ) : workbooks.length === 0 ? (
            <EmptyState
              title="No workbooks yet"
              body="Create one on the left. Lists come from GET /workbooks."
            />
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {workbooks.map((wb) => (
                <li
                  key={wb.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <Link
                      to={`/workbooks/${wb.id}`}
                      className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                    >
                      {wb.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-[var(--color-ink-muted)]">
                      id {wb.id} · main {formatPaise(wb.main_capital_paise)} · available{" "}
                      {formatPaise(wb.available_paise)}
                    </p>
                  </div>
                  <Link
                    to={`/workbooks/${wb.id}`}
                    className="inline-flex items-center justify-center rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-2 text-sm font-medium hover:bg-[var(--color-paper)]"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}
