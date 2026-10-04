/** Agent FastAPI via Vite `/agent` → :8100 (no path rewrite). */
const AGENT_BASE = (import.meta.env.VITE_AGENT_URL ?? "/agent").replace(/\/$/, "");

function agentUrl(path: string): string {
  return `${AGENT_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function getToken(): string | null {
  return localStorage.getItem("algocraft_token");
}

export class AgentApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message || (typeof body === "string" ? body : `HTTP ${status}`));
    this.name = "AgentApiError";
    this.status = status;
    this.body = body;
  }
}

async function agentFetch<T>(
  path: string,
  init: RequestInit = {},
  opts: { auth?: boolean } = { auth: true },
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (opts.auth !== false) {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  const res = await fetch(agentUrl(path), { ...init, headers });
  const text = await res.text();
  let parsed: unknown = text;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    const detail =
      typeof parsed === "object" && parsed && "detail" in parsed
        ? (parsed as { detail: unknown }).detail
        : parsed;
    const message =
      typeof detail === "object" && detail && "message" in detail
        ? String((detail as { message: string }).message)
        : typeof detail === "string"
          ? detail
          : `HTTP ${res.status}`;
    throw new AgentApiError(res.status, detail, message);
  }
  return parsed as T;
}

export type LlmModelOut = {
  id: string;
  label: string;
  reachable?: boolean | null;
};

export type LlmProviderOut = {
  id: string;
  label: string;
  available: boolean;
  status?: string | null;
  models: LlmModelOut[];
};

export type LlmCatalogResponse = {
  default_provider: string;
  default_model: string;
  default_temperature: number;
  temperature_min: number;
  temperature_max: number;
  providers: LlmProviderOut[];
};

export type SessionLlmOut = {
  session_id: string;
  provider: string;
  model: string;
  temperature: number;
  workbook_id?: number | null;
};

/** One step in the agent thinking trail (POST /v1/chat + SSE `thinking`). */
export type ThinkingCrumb = {
  agent: string;
  phase?: "decide" | "tool" | "result" | "start" | "end" | string;
  thought: string;
  data?: Record<string, unknown> | null;
};

export type SessionDetailOut = SessionLlmOut & {
  messages: { role: string; content: string }[];
  last_metrics?: Record<string, unknown> | null;
  last_card?: Record<string, unknown> | null;
  last_thinking?: ThinkingCrumb[] | null;
  pending_human?: "none" | "promote" | "activate";
  pending_strategy_name?: string | null;
};

export type ChatResponse = {
  session_id: string;
  intent?: string | null;
  verdict?: string | null;
  response_text?: string | null;
  metrics?: Record<string, unknown> | null;
  card?: Record<string, unknown> | null;
  thinking?: ThinkingCrumb[] | null;
  provider: string;
  model: string;
  temperature: number;
  error?: string | null;
};

export type ConfirmResponse = {
  session_id: string;
  action: "promote" | "activate";
  verdict?: string | null;
  pending_human: string;
  response_text?: string | null;
  metrics?: Record<string, unknown> | null;
  card?: Record<string, unknown> | null;
  thinking?: ThinkingCrumb[] | null;
  error?: string | null;
};

export function normalizeThinking(raw: unknown): ThinkingCrumb[] {
  if (!Array.isArray(raw)) return [];
  const out: ThinkingCrumb[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const agent = typeof row.agent === "string" ? row.agent : "";
    const thought = typeof row.thought === "string" ? row.thought : "";
    if (!agent && !thought) continue;
    out.push({
      agent: agent || "agent",
      phase: typeof row.phase === "string" ? row.phase : undefined,
      thought,
      data:
        row.data && typeof row.data === "object" && !Array.isArray(row.data)
          ? (row.data as Record<string, unknown>)
          : null,
    });
  }
  return out;
}

export function fetchLlmCatalog(refresh = false): Promise<LlmCatalogResponse> {
  const q = refresh ? "?refresh=true" : "";
  return agentFetch(`/v1/llm/catalog${q}`, {}, { auth: false });
}

export function createAgentSession(body: {
  workbook_id?: number;
  provider?: string;
  model?: string;
  temperature?: number;
}): Promise<SessionLlmOut> {
  return agentFetch("/v1/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getAgentSession(sessionId: string): Promise<SessionDetailOut> {
  return agentFetch(`/v1/sessions/${encodeURIComponent(sessionId)}`);
}

export function patchAgentLlm(
  sessionId: string,
  body: { provider?: string; model?: string; temperature?: number },
): Promise<SessionLlmOut> {
  return agentFetch(`/v1/sessions/${encodeURIComponent(sessionId)}/llm`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function postChat(body: {
  session_id: string;
  message: string;
  provider?: string;
  model?: string;
  temperature?: number;
}): Promise<ChatResponse> {
  return agentFetch("/v1/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postConfirm(
  sessionId: string,
  action: "promote" | "activate",
): Promise<ConfirmResponse> {
  return agentFetch(`/v1/sessions/${encodeURIComponent(sessionId)}/confirm`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

/** Absolute URL for EventSource (must be same-origin via Vite proxy). */
export function chatStreamUrl(sessionId: string): string {
  return agentUrl(`/v1/chat/${encodeURIComponent(sessionId)}/stream`);
}
