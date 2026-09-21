import { NavLink, Outlet, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { Button } from "@/components/ui";

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
  const { workbookId } = useParams();
  const wid = workbookId ? Number(workbookId) : NaN;

  const workbooksQuery = useQuery({
    queryKey: ["workbooks"],
    queryFn: api.listWorkbooks,
    staleTime: 30_000,
  });

  const current =
    Number.isFinite(wid) && wid > 0
      ? workbooksQuery.data?.find((w) => w.id === wid)
      : undefined;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-paper)_92%,white)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-4">
            <NavLink to="/workbooks" className="font-mono text-xs tracking-[0.2em] text-[var(--color-accent)] uppercase">
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
            <span className="text-sm text-[var(--color-ink-muted)]">{user?.username}</span>
            <Button variant="secondary" type="button" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
