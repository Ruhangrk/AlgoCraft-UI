import { apiFetch } from "@/api/client";
import type {
  AuthResponse,
  ContainerRow,
  FillRow,
  PortfolioSnapshot,
  RunStartRequest,
  RunStartResponse,
  RunSummary,
  User,
  Workbook,
  WorkbookCreateResponse,
} from "@/types/api";

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

export function getPortfolio(workbookId: number): Promise<PortfolioSnapshot> {
  return apiFetch<PortfolioSnapshot>(`/workbooks/${workbookId}/portfolio`);
}

export function listRuns(workbookId: number): Promise<RunSummary[]> {
  return apiFetch<RunSummary[]>(`/workbooks/${workbookId}/runs`);
}

export function startRun(workbookId: number, body: RunStartRequest): Promise<RunStartResponse> {
  return apiFetch<RunStartResponse>(`/workbooks/${workbookId}/runs/start`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listContainers(workbookId: number): Promise<ContainerRow[]> {
  return apiFetch<ContainerRow[]>(`/workbooks/${workbookId}/containers`);
}

export function listFills(workbookId: number): Promise<FillRow[]> {
  return apiFetch<FillRow[]>(`/workbooks/${workbookId}/fills`);
}
