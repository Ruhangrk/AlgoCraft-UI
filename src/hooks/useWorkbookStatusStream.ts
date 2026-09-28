import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/api/client";
import { workbookStreamPath } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthProvider";
import type { PortfolioSnapshot } from "@/types/api";

/** Live-run container snapshot from SSE (no persisted id/run_id yet). */
export type LiveContainerSnap = {
  workbook_id?: number;
  ticker?: string;
  strategy?: string;
  allocation_paise?: number;
  realized_paise?: number;
  fills?: number;
  mode?: string;
};

export function containersLiveKey(workbookId: number) {
  return ["containers-live", workbookId] as const;
}

/**
 * Subscribe to Crow SSE status streams for a workbook.
 * Backend sends one event then closes; EventSource reconnects via retry: 2000.
 * Auth is ?token= (EventSource cannot set Authorization).
 *
 * Portfolio → ["portfolio", wid] (full replace).
 * Containers → ["containers-live", wid] only — never wipe the HTTP history list.
 */
export function useWorkbookStatusStream(workbookId: number, enabled: boolean): void {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  useEffect(() => {
    if (!enabled || !token || !Number.isFinite(workbookId) || workbookId <= 0) {
      return;
    }

    const sources: EventSource[] = [];

    function open(channel: "portfolio" | "containers") {
      const es = new EventSource(apiUrl(workbookStreamPath(workbookId, channel, token!)));
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as unknown;
          if (channel === "portfolio") {
            queryClient.setQueryData(["portfolio", workbookId], data as PortfolioSnapshot);
          } else {
            // Live active set only — merge on the page with GET /containers history.
            queryClient.setQueryData(
              containersLiveKey(workbookId),
              Array.isArray(data) ? (data as LiveContainerSnap[]) : [],
            );
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      sources.push(es);
    }

    open("portfolio");
    open("containers");

    return () => {
      for (const es of sources) {
        es.close();
      }
    };
  }, [workbookId, enabled, token, queryClient]);
}
