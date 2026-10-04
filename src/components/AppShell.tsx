import { useState } from "react";
import { NavLink, Outlet, useMatch } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { Button } from "@/components/ui";
import { AgentSidePanel } from "@/features/AgentSidePanel";
import { PrefKeys, loadJson, type AgentPanelPrefs } from "@/lib/prefs";

function navClass({ isActive }: { isActive: boolean }): string {
  return [
    "rounded-md px-2.5 py-1.5 text-sm font-medium transition",
    isActive
      ? "bg-[var(--color-ink)] text-white"
      : "text-[var(--color-ink-muted)] hover:bg-white hover:text-[var(--color-ink)]",
  ].join(" ");
}

export function AppShell() {
  const { user, logout } = useAuth();
  const wbMatch = useMatch({ path: "/workbooks/:workbookId", end: false });
  const widRaw = wbMatch?.params.workbookId;
  const wid = widRaw ? Number(widRaw) : NaN;
  const workbookId = Number.isFinite(wid) && wid > 0 ? wid : null;

  const [agentOpen, setAgentOpen] = useState(
    () => loadJson<AgentPanelPrefs>(PrefKeys.agentPanel)?.open ?? true,
  );

  const workbooksQuery = useQuery({
    queryKey: ["workbooks"],
    queryFn: api.listWorkbooks,
    staleTime: 30_000,
  });

  const current =
    workbookId != null
      ? workbooksQuery.data?.find((w) => w.id === workbookId)
      : undefined;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="sticky top-0 z-20 shrink-0 border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-paper)_92%,white)] backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-4">
            <NavLink
              to="/workbooks"
              className="font-mono text-xs tracking-[0.2em] text-[var(--color-accent)] uppercase"
            >
              AlgoCraft
            </NavLink>
            <nav className="flex flex-wrap items-center gap-1">
              <NavLink to="/workbooks" className={navClass} end>
                Workbooks
              </NavLink>
              <NavLink to="/markets" className={navClass}>
                Markets
              </NavLink>
              {current ? (
                <NavLink to={`/workbooks/${current.id}`} className={navClass}>
                  {current.name}
                </NavLink>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant={agentOpen ? "primary" : "secondary"}
              onClick={() => setAgentOpen((o) => !o)}
              aria-pressed={agentOpen}
            >
              Agent
            </Button>
            <span className="text-sm text-[var(--color-ink-muted)]">{user?.username}</span>
            <Button variant="secondary" type="button" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto">
          <Outlet />
        </div>
        <AgentSidePanel
          open={agentOpen}
          onOpenChange={setAgentOpen}
          workbookId={workbookId}
        />
      </div>
    </div>
  );
}
