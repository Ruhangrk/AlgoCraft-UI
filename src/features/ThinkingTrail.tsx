import { useState } from "react";
import type { ThinkingCrumb } from "@/api/agent";

const AGENT_LABELS: Record<string, string> = {
  classify_intent: "Classifier",
  research: "Research",
  propose: "Propose",
  execute: "Execute",
  evaluate: "Evaluate",
  design_code: "Design",
  compile_loop: "Compile",
  respond: "Respond",
  human_gate: "Human gate",
  promote: "Promote",
  activate: "Activate",
  lifecycle: "Lifecycle",
};

export function agentDisplayName(agent: string): string {
  return AGENT_LABELS[agent] ?? agent.replace(/_/g, " ");
}

function phaseBadgeClass(phase: string | undefined): string {
  switch (phase) {
    case "decide":
      return "bg-sky-100 text-sky-800";
    case "tool":
      return "bg-amber-100 text-amber-900";
    case "result":
      return "bg-emerald-100 text-emerald-900";
    case "start":
      return "bg-slate-100 text-slate-700";
    case "end":
      return "bg-violet-100 text-violet-900";
    default:
      return "bg-[var(--color-paper)] text-[var(--color-ink-muted)]";
  }
}

export function ThinkingTrail({
  crumbs,
  defaultOpen = false,
}: {
  crumbs: ThinkingCrumb[];
  /** Auto-expand on error turns. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (crumbs.length === 0) return null;

  const agents = [...new Set(crumbs.map((c) => agentDisplayName(c.agent)))];
  const summary =
    agents.length <= 3
      ? agents.join(" · ")
      : `${agents.slice(0, 2).join(" · ")} +${agents.length - 2}`;

  return (
    <div className="mt-1.5 rounded-md border border-[var(--color-line)]/80 bg-white/60">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-mono text-[10px] opacity-70" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <span className="font-medium tracking-wide uppercase">Thinking</span>
        <span className="truncate font-mono text-[10px]">
          {crumbs.length} · {summary}
        </span>
      </button>
      {open ? (
        <ol className="max-h-48 space-y-2 overflow-y-auto border-t border-[var(--color-line)]/60 px-2 py-2">
          {crumbs.map((c, i) => (
            <li key={`${c.agent}-${i}`} className="text-[11px] leading-snug">
              <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-[var(--color-ink)]">
                  {agentDisplayName(c.agent)}
                </span>
                {c.phase ? (
                  <span
                    className={`rounded px-1 py-px font-mono text-[9px] tracking-wide uppercase ${phaseBadgeClass(c.phase)}`}
                  >
                    {c.phase}
                  </span>
                ) : null}
              </div>
              {c.thought ? (
                <p className="whitespace-pre-wrap text-[var(--color-ink-muted)]">{c.thought}</p>
              ) : null}
              {c.data && Object.keys(c.data).length > 0 ? (
                <pre className="mt-1 max-h-20 overflow-auto rounded bg-[var(--color-paper)] px-1.5 py-1 font-mono text-[9px] text-[var(--color-ink-muted)]">
                  {JSON.stringify(c.data, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
