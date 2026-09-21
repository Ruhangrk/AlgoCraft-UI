import { useNavigate } from "react-router-dom";
import { InstrumentSearch } from "@/components/InstrumentSearch";
import { PageShell, Panel } from "@/components/ui";

export function MarketsPage() {
  const navigate = useNavigate();

  return (
    <PageShell
      title="Markets"
      subtitle="Search the NSE equity catalog, then open a stock for charts and research."
    >
      <Panel title="Find a stock">
        <InstrumentSearch
          autoFocus
          placeholder="Try RELI, INFY, TCS…"
          onSelect={(inst) => navigate(`/markets/${inst.ticker}`)}
        />
        <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
          Catalog from AlgoCraft <span className="font-mono">GET /instruments</span>. Results are
          cached in TanStack Query for this session.
        </p>
      </Panel>
    </PageShell>
  );
}
