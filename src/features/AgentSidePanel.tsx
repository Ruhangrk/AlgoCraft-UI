import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AgentChat } from "@/features/AgentChat";
import {
  PrefKeys,
  loadJson,
  saveJson,
  type AgentPanelPrefs,
} from "@/lib/prefs";

const MIN_W = 280;
const MAX_W = 720;
const DEFAULT_W = 380;

function clampWidth(w: number): number {
  const max =
    typeof window !== "undefined"
      ? Math.min(MAX_W, Math.floor(window.innerWidth * 0.7))
      : MAX_W;
  return Math.max(MIN_W, Math.min(max, Math.round(w)));
}

export function AgentSidePanel({
  open,
  onOpenChange,
  workbookId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workbookId: number | null;
}) {
  const prefs = loadJson<AgentPanelPrefs>(PrefKeys.agentPanel);
  const [width, setWidth] = useState(() => clampWidth(prefs?.width ?? DEFAULT_W));
  const dragging = useRef(false);

  useEffect(() => {
    saveJson(PrefKeys.agentPanel, { open, width } satisfies AgentPanelPrefs);
  }, [open, width]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return;
    setWidth(clampWidth(window.innerWidth - e.clientX));
  }, []);

  const stopDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDrag);
  }, [onPointerMove]);

  function startDrag(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
  }

  useEffect(() => () => stopDrag(), [stopDrag]);

  if (!open) {
    return null;
  }

  return (
    <aside
      className="relative flex h-full min-h-0 shrink-0 flex-col border-l border-[var(--color-line)] bg-[var(--color-panel)] shadow-[-4px_0_24px_rgba(15,20,25,0.04)]"
      style={{ width }}
      aria-label="Agent chat panel"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize agent panel"
        tabIndex={0}
        className="absolute top-0 left-0 z-10 h-full w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50"
        onPointerDown={startDrag}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            setWidth((w) => clampWidth(w + 16));
          } else if (e.key === "ArrowRight") {
            setWidth((w) => clampWidth(w - 16));
          }
        }}
      />
      <AgentChat workbookId={workbookId} onClose={() => onOpenChange(false)} />
    </aside>
  );
}
