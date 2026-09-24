import { apiFetch } from "@/api/client";
import type {
  AuthResponse,
  BacktestRow,
  BacktestStartRequest,
  ChartResolution,
  ContainerRow,
  FillRow,
  HistoryListParams,
  Instrument,
  OhlcvResponse,
  PortfolioSnapshot,
  RunEvent,
  RunStartRequest,
  RunStartResponse,
  RunStopResponse,
  RunSummary,
  User,
  Workbook,
  WorkbookCapitalTopUp,
  WorkbookCreateResponse,
} from "@/types/api";

function historyQuery(params?: HistoryListParams): string {
  if (!params) {
    return "";
  }
  const q = new URLSearchParams();
  if (params.from) {
    q.set("from", params.from);
  }
  if (params.to) {
    q.set("to", params.to);
  }
  if (params.limit != null && params.limit > 0) {
    q.set("limit", String(params.limit));
  }
  if (params.cursor != null && params.cursor > 0) {
    q.set("cursor", String(params.cursor));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function register(username: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(
    "/auth/register",
    { method: "POST", body: JSON.stringify({ username, password }) },
    { auth: false },
  );
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ username, password }) },
    { auth: false },
  );
}

export function fetchMe(): Promise<User> {
  return apiFetch<User>("/auth/me");
}

export function listStrategies(): Promise<string[]> {
  return apiFetch<string[]>("/strategies", {}, { auth: false });
}

export function listRoutingAlgos(): Promise<string[]> {
  return apiFetch<string[]>("/routing-algos", {}, { auth: false });
}

export function listWorkbooks(): Promise<Workbook[]> {
  return apiFetch<Workbook[]>("/workbooks");
}

export function createWorkbook(name: string, capital_paise: number): Promise<WorkbookCreateResponse> {
  return apiFetch<WorkbookCreateResponse>("/workbooks", {
    method: "POST",
    body: JSON.stringify({ name, capital_paise }),
  });
}

/** Top-up workbook main + available capital (paise). */
export function addWorkbookCapital(
  workbookId: number,
  add_capital_paise: number,
): Promise<WorkbookCapitalTopUp> {
  return apiFetch<WorkbookCapitalTopUp>(`/workbooks/${workbookId}`, {
    method: "PATCH",
    body: JSON.stringify({ add_capital_paise }),
  });
}

export function getPortfolio(workbookId: number): Promise<PortfolioSnapshot> {
  return apiFetch<PortfolioSnapshot>(`/workbooks/${workbookId}/portfolio`);
}

export function listRuns(
  workbookId: number,
  params?: HistoryListParams,
): Promise<RunSummary[]> {
  return apiFetch<RunSummary[]>(`/workbooks/${workbookId}/runs${historyQuery(params)}`);
}

export function startRun(workbookId: number, body: RunStartRequest): Promise<RunStartResponse> {
  return apiFetch<RunStartResponse>(`/workbooks/${workbookId}/runs/start`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function stopRun(workbookId: number): Promise<RunStopResponse> {
  return apiFetch<RunStopResponse>(`/workbooks/${workbookId}/runs/stop`, {
    method: "POST",
  });
}

export function listContainers(workbookId: number): Promise<ContainerRow[]> {
  return apiFetch<ContainerRow[]>(`/workbooks/${workbookId}/containers`);
}

export function getContainer(workbookId: number, containerId: number): Promise<ContainerRow> {
  return apiFetch<ContainerRow>(`/workbooks/${workbookId}/containers/${containerId}`);
}

export function listContainerEvents(
  workbookId: number,
  containerId: number,
  include = "all",
): Promise<RunEvent[]> {
  const q = new URLSearchParams({ include });
  return apiFetch<RunEvent[]>(
    `/workbooks/${workbookId}/containers/${containerId}/events?${q}`,
  );
}

export function listFills(workbookId: number): Promise<FillRow[]> {
  return apiFetch<FillRow[]>(`/workbooks/${workbookId}/fills`);
}

export function searchInstruments(q: string, limit = 20): Promise<Instrument[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return apiFetch<Instrument[]>(`/instruments?${params}`);
}

export function getInstrument(ticker: string): Promise<Instrument> {
  return apiFetch<Instrument>(`/instruments/${encodeURIComponent(ticker)}`);
}

export function startBacktest(
  workbookId: number,
  body: BacktestStartRequest,
): Promise<BacktestRow> {
  return apiFetch<BacktestRow>(`/workbooks/${workbookId}/backtests/start`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listBacktests(
  workbookId: number,
  params?: HistoryListParams,
): Promise<BacktestRow[]> {
  return apiFetch<BacktestRow[]>(`/workbooks/${workbookId}/backtests${historyQuery(params)}`);
}

export function getBacktest(workbookId: number, backtestId: number): Promise<BacktestRow> {
  return apiFetch<BacktestRow>(`/workbooks/${workbookId}/backtests/${backtestId}`);
}

export function deleteBacktest(workbookId: number, backtestId: number): Promise<{ id: number; deleted: boolean }> {
  return apiFetch(`/workbooks/${workbookId}/backtests/${backtestId}`, { method: "DELETE" });
}

export function deleteRun(workbookId: number, runId: number): Promise<{ id: number; deleted: boolean }> {
  return apiFetch(`/workbooks/${workbookId}/runs/${runId}`, { method: "DELETE" });
}

export function listRunEvents(
  workbookId: number,
  runId: number,
  include = "all",
  containerId?: number,
): Promise<RunEvent[]> {
  const q = new URLSearchParams({ include });
  if (containerId != null && containerId > 0) {
    q.set("container_id", String(containerId));
  }
  return apiFetch<RunEvent[]>(`/workbooks/${workbookId}/runs/${runId}/events?${q}`);
}

export function getOhlcv(
  ticker: string,
  resolution: ChartResolution,
  from: string,
  to: string,
): Promise<OhlcvResponse> {
  const params = new URLSearchParams({ resolution, from, to });
  return apiFetch<OhlcvResponse>(
    `/instruments/${encodeURIComponent(ticker)}/ohlcv?${params}`,
  );
}
