import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AgentApiError,
  chatStreamUrl,
  createAgentSession,
  fetchLlmCatalog,
  getAgentSession,
  normalizeThinking,
  patchAgentLlm,
  postChat,
  postConfirm,
  type ChatResponse,
  type ConfirmResponse,
  type LlmCatalogResponse,
  type LlmProviderOut,
  type ThinkingCrumb,
} from "@/api/agent";
import { ThinkingTrail } from "@/features/ThinkingTrail";
import { Button, ErrorBanner, TextInput } from "@/components/ui";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: ThinkingCrumb[];
  /** Expand thinking by default (error / fail turns). */
  thinkingOpen?: boolean;
};

type AgentCard = Record<string, unknown>;

const selectClass =
  "w-full rounded-md border border-[var(--color-line)] bg-white px-2 py-1.5 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]";

function formatCardValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function CardSummary({ card }: { card: AgentCard | null }) {
  if (!card) return null;
  const keys = [
    "verdict",
    "intent",
    "strategy",
    "strategy_name",
    "ticker",
    "fills",
    "pnl_paise",
    "run_id",
    "backtest_id",
    "compile_ok",
  ];
  const rows = keys
    .filter((k) => card[k] != null && card[k] !== "")
    .map((k) => [k, formatCardValue(card[k])] as const);
  if (rows.length === 0) {
    return (
      <pre className="max-h-28 overflow-auto rounded-md bg-[var(--color-paper)] p-2 font-mono text-[10px] leading-relaxed">
        {JSON.stringify(card, null, 2)}
      </pre>
    );
  }
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-2">
      <p className="mb-1.5 text-[10px] font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
        Result card
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono text-[11px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[var(--color-ink-muted)]">{k}</dt>
            <dd className="truncate text-[var(--color-ink)]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function pickInitialLlm(catalog: LlmCatalogResponse): {
  provider: string;
  model: string;
  temperature: number;
} {
  const available = catalog.providers.filter((p) => p.available && p.models.length > 0);
  const preferred =
    available.find((p) => p.id === catalog.default_provider) ?? available[0] ?? null;
  if (!preferred) {
    return {
      provider: catalog.default_provider,
      model: catalog.default_model,
      temperature: catalog.default_temperature,
    };
  }
  const model =
    preferred.models.find((m) => m.id === catalog.default_model)?.id ??
    preferred.models[0]?.id ??
    catalog.default_model;
  return {
    provider: preferred.id,
    model,
    temperature: catalog.default_temperature,
  };
}

function modelsForProvider(
  providers: LlmProviderOut[],
  providerId: string,
): { id: string; label: string }[] {
  return providers.find((p) => p.id === providerId)?.models ?? [];
}

function isErrorTurn(result: ChatResponse | ConfirmResponse): boolean {
  if (result.error) return true;
  const v = result.verdict;
  return v === "error" || v === "fail";
}

/** Replay SSE thinking events (post-turn). Prefer POST `thinking` when present. */
function collectThinkingFromStream(sessionId: string): Promise<ThinkingCrumb[]> {
  return new Promise((resolve) => {
    const crumbs: ThinkingCrumb[] = [];
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        es.close();
      } catch {
        /* ignore */
      }
      resolve(crumbs);
    };

    const es = new EventSource(chatStreamUrl(sessionId));
    const timer = window.setTimeout(finish, 8_000);

    es.addEventListener("thinking", (ev) => {
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as unknown;
        const one = normalizeThinking([parsed]);
        crumbs.push(...one);
      } catch {
        /* ignore bad event */
      }
    });
    es.addEventListener("done", () => {
      window.clearTimeout(timer);
      finish();
    });
    es.addEventListener("error", () => {
      window.clearTimeout(timer);
      finish();
    });
    es.onerror = () => {
      window.clearTimeout(timer);
      finish();
    };
  });
}

export function AgentChat({
  workbookId,
  onClose,
}: {
  workbookId: number | null;
  onClose?: () => void;
}) {
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [catalog, setCatalog] = useState<LlmCatalogResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.2);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [card, setCard] = useState<AgentCard | null>(null);
  const [pendingHuman, setPendingHuman] = useState<"none" | "promote" | "activate">("none");
  const [pendingStrategy, setPendingStrategy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableProviders = useMemo(
    () => (catalog?.providers ?? []).filter((p) => p.available),
    [catalog],
  );
  const modelOptions = useMemo(
    () => modelsForProvider(catalog?.providers ?? [], provider),
    [catalog, provider],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, card, busy]);

  async function bootSession(refreshCatalog: boolean) {
    setBootError(null);
    setError(null);
    setBusy(true);
    try {
      const cat = await fetchLlmCatalog(refreshCatalog);
      setCatalog(cat);
      const initial = pickInitialLlm(cat);
      setProvider(initial.provider);
      setModel(initial.model);
      setTemperature(initial.temperature);
      const session = await createAgentSession({
        ...(workbookId != null && workbookId > 0 ? { workbook_id: workbookId } : {}),
        provider: initial.provider,
        model: initial.model,
        temperature: initial.temperature,
      });
      setSessionId(session.session_id);
      setProvider(session.provider);
      setModel(session.model);
      setTemperature(session.temperature);
      setMessages([]);
      setCard(null);
      setPendingHuman("none");
      setPendingStrategy(null);
      setDraft("");
    } catch (e) {
      const msg =
        e instanceof AgentApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to start agent session";
      setBootError(
        msg.trim()
          ? `${msg}. Is AlgoCraft-Agent running on :8100?`
          : "Cannot reach AlgoCraft-Agent on :8100.",
      );
      setSessionId(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void bootSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-bind session when workbook context changes
  }, [workbookId]);

  async function applyLlm(next: {
    provider?: string;
    model?: string;
    temperature?: number;
  }) {
    if (!sessionId) return;
    setError(null);
    try {
      const updated = await patchAgentLlm(sessionId, next);
      setProvider(updated.provider);
      setModel(updated.model);
      setTemperature(updated.temperature);
    } catch (e) {
      setError(e instanceof AgentApiError ? e.message : "Failed to update LLM settings");
    }
  }

  function onProviderChange(nextProvider: string) {
    const models = modelsForProvider(catalog?.providers ?? [], nextProvider);
    const nextModel =
      models.find((m) => m.id === model)?.id ?? models[0]?.id ?? model;
    setProvider(nextProvider);
    setModel(nextModel);
    void applyLlm({ provider: nextProvider, model: nextModel });
  }

  function onModelChange(nextModel: string) {
    setModel(nextModel);
    void applyLlm({ model: nextModel });
  }

  function onTemperatureChange(nextTemp: number) {
    const min = catalog?.temperature_min ?? 0;
    const max = catalog?.temperature_max ?? 2;
    const clamped = Math.min(max, Math.max(min, nextTemp));
    setTemperature(clamped);
    void applyLlm({ temperature: clamped });
  }

  function applyTurnResult(
    userText: string,
    result: ChatResponse | ConfirmResponse,
    thinkingOverride?: ThinkingCrumb[],
  ) {
    const thinking =
      thinkingOverride && thinkingOverride.length > 0
        ? thinkingOverride
        : normalizeThinking(result.thinking);
    const openThinking = isErrorTurn(result);
    setMessages((prev) => {
      const next = [...prev, { role: "user" as const, content: userText }];
      const content = result.response_text || result.error || "";
      if (content || thinking.length > 0) {
        next.push({
          role: "assistant",
          content: content || "(no reply text)",
          thinking,
          thinkingOpen: openThinking,
        });
      }
      return next;
    });
    if (result.card) {
      setCard(result.card as AgentCard);
    }
    if ("pending_human" in result && result.pending_human) {
      setPendingHuman(
        result.pending_human === "promote" || result.pending_human === "activate"
          ? result.pending_human
          : "none",
      );
    }
    const name =
      (result.card as AgentCard | null)?.strategy_name ??
      (result.card as AgentCard | null)?.strategy ??
      null;
    if (typeof name === "string") {
      setPendingStrategy(name);
    }
    if (workbookId != null && workbookId > 0) {
      void queryClient.invalidateQueries({ queryKey: ["workbooks", workbookId] });
      void queryClient.invalidateQueries({ queryKey: ["backtests", workbookId] });
      void queryClient.invalidateQueries({ queryKey: ["runs", workbookId] });
      void queryClient.invalidateQueries({ queryKey: ["containers", workbookId] });
    }
  }

  async function refreshPending(sid: string) {
    try {
      const detail = await getAgentSession(sid);
      setPendingHuman(
        detail.pending_human === "promote" || detail.pending_human === "activate"
          ? detail.pending_human
          : "none",
      );
      setPendingStrategy(detail.pending_strategy_name ?? null);
      if (detail.last_card) {
        setCard(detail.last_card as AgentCard);
      }
      const crumbs = normalizeThinking(detail.last_thinking);
      if (crumbs.length === 0) return;
      setMessages((prev) => {
        let lastAsst = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].role === "assistant") {
            lastAsst = i;
            break;
          }
        }
        if (lastAsst < 0) return prev;
        if (prev[lastAsst].thinking && prev[lastAsst].thinking!.length > 0) return prev;
        const copy = [...prev];
        copy[lastAsst] = { ...copy[lastAsst], thinking: crumbs };
        return copy;
      });
    } catch {
      /* ignore */
    }
  }

  async function resolveThinking(
    sid: string,
    fromBody: ThinkingCrumb[] | null | undefined,
  ): Promise<ThinkingCrumb[]> {
    const body = normalizeThinking(fromBody);
    if (body.length > 0) return body;
    try {
      return await collectThinkingFromStream(sid);
    } catch {
      return [];
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !sessionId || busy) return;
    setBusy(true);
    setError(null);
    setDraft("");
    try {
      const result = await postChat({
        session_id: sessionId,
        message: trimmed,
        provider,
        model,
        temperature,
      });
      const thinking = await resolveThinking(sessionId, result.thinking);
      applyTurnResult(trimmed, result, thinking);
      await refreshPending(sessionId);
      if (result.error) {
        setError(result.error);
      }
    } catch (e) {
      if (e instanceof AgentApiError && e.status === 429) {
        setError(`${e.message} — switch provider/model and retry.`);
      } else {
        setError(e instanceof AgentApiError ? e.message : "Chat request failed");
      }
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm(action: "promote" | "activate") {
    if (!sessionId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await postConfirm(sessionId, action);
      const thinking = normalizeThinking(result.thinking);
      applyTurnResult(`APPROVE_${action.toUpperCase()}`, result, thinking);
      await refreshPending(sessionId);
      if (result.error) {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof AgentApiError ? e.message : "Confirm failed");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage(draft);
  }

  const tempMin = catalog?.temperature_min ?? 0;
  const tempMax = catalog?.temperature_max ?? 2;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-panel)]">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-line)] px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-[var(--color-ink)] uppercase">
            Agent
          </p>
          <p className="truncate font-mono text-[10px] text-[var(--color-ink-muted)]">
            {workbookId != null && workbookId > 0
              ? `workbook #${workbookId}`
              : "no workbook context"}
            {sessionId ? ` · ${sessionId.slice(0, 8)}…` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            className="px-2 py-1 text-xs"
            disabled={busy}
            onClick={() => void bootSession(true)}
          >
            New
          </Button>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={onClose}
              aria-label="Close agent panel"
            >
              ✕
            </Button>
          ) : null}
        </div>
      </header>

      <div className="shrink-0 space-y-2 border-b border-[var(--color-line)] px-3 py-2">
        {(bootError || error) && <ErrorBanner message={bootError || error} />}
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-[10px] font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
              Provider
            </span>
            <select
              className={selectClass}
              value={provider}
              disabled={!catalog || busy}
              onChange={(e) => onProviderChange(e.target.value)}
            >
              {availableProviders.length === 0 ? (
                <option value={provider || ""}>{provider || "—"}</option>
              ) : (
                availableProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
              Model
            </span>
            <select
              className={selectClass}
              value={model}
              disabled={!catalog || busy || modelOptions.length === 0}
              onChange={(e) => onModelChange(e.target.value)}
            >
              {modelOptions.length === 0 ? (
                <option value={model || ""}>{model || "—"}</option>
              ) : (
                modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-[10px] font-medium tracking-wide text-[var(--color-ink-muted)] uppercase">
            Temperature {temperature.toFixed(2)}
          </span>
          <input
            type="range"
            min={tempMin}
            max={tempMax}
            step={0.05}
            value={temperature}
            disabled={!catalog || busy}
            className="w-full accent-[var(--color-accent)]"
            onChange={(e) => onTemperatureChange(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !busy ? (
          <p className="m-auto max-w-[16rem] text-center text-sm text-[var(--color-ink-muted)]">
            Ask the agent to research, backtest, or design a strategy.
            Promote/activate always needs your confirmation.
          </p>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <div
                key={`user-${i}`}
                className="ml-auto max-w-[95%] rounded-lg bg-[var(--color-ink)] px-3 py-2 text-sm whitespace-pre-wrap text-white"
              >
                {m.content}
              </div>
            ) : (
              <div key={`asst-${i}`} className="mr-auto max-w-[95%]">
                <div className="rounded-lg bg-[var(--color-paper)] px-3 py-2 text-sm whitespace-pre-wrap text-[var(--color-ink)]">
                  {m.content}
                </div>
                {m.thinking && m.thinking.length > 0 ? (
                  <ThinkingTrail crumbs={m.thinking} defaultOpen={Boolean(m.thinkingOpen)} />
                ) : null}
              </div>
            ),
          )
        )}
        {busy ? (
          <p className="font-mono text-xs text-[var(--color-ink-muted)]">Agent running…</p>
        ) : null}
        <CardSummary card={card} />
        <div ref={bottomRef} />
      </div>

      {pendingHuman === "promote" || pendingHuman === "activate" ? (
        <div className="shrink-0 space-y-2 border-t border-[var(--color-line)] px-3 py-2">
          <p className="text-xs text-[var(--color-ink)]">
            Confirm {pendingHuman}
            {pendingStrategy ? (
              <>
                {" "}
                for <span className="font-mono">{pendingStrategy}</span>
              </>
            ) : null}
            .
          </p>
          <Button
            type="button"
            className="w-full"
            disabled={busy || !sessionId}
            onClick={() => void onConfirm(pendingHuman)}
          >
            Approve {pendingHuman}
          </Button>
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="shrink-0 border-t border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-paper)_70%,white)] p-3"
      >
        <div className="flex gap-2">
          <TextInput
            value={draft}
            disabled={!sessionId || busy}
            placeholder={sessionId ? "Message agent…" : "Starting session…"}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button type="submit" disabled={!sessionId || busy || !draft.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
