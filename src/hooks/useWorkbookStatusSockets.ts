import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import type { ContainerRow, PortfolioSnapshot } from "@/types/api";

function workbookWsUrl(channel: "portfolio" | "containers", workbookId: number, token: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  // Proxied by Vite `/ws` → AlgoCraft :8080 (see vite.config.ts).
  return `${proto}//${window.location.host}/ws/workbooks/${workbookId}/${channel}?token=${encodeURIComponent(token)}`;
}

/**
 * Subscribe to Crow status sockets for a workbook.
 * Snapshots + live pushes update TanStack Query caches for capital / containers.
 */
export function useWorkbookStatusSockets(workbookId: number, enabled: boolean): void {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  useEffect(() => {
    if (!enabled || !token || !Number.isFinite(workbookId) || workbookId <= 0) {
      return;
    }

    const sockets: WebSocket[] = [];

    function open(channel: "portfolio" | "containers") {
      const ws = new WebSocket(workbookWsUrl(channel, workbookId, token!));
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as unknown;
          if (channel === "portfolio") {
            queryClient.setQueryData(["portfolio", workbookId], data as PortfolioSnapshot);
            void queryClient.invalidateQueries({ queryKey: ["workbooks"] });
          } else {
            queryClient.setQueryData(["containers", workbookId], data as ContainerRow[]);
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      sockets.push(ws);
    }

    open("portfolio");
    open("containers");

    return () => {
      for (const ws of sockets) {
        ws.close();
      }
    };
  }, [workbookId, enabled, token, queryClient]);
}
