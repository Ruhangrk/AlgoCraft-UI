export type UserRole = "user" | "admin" | string;

export interface User {
  id: number;
  username: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Workbook {
  id: number;
  name: string;
  main_capital_paise: number;
  available_paise: number;
}

export interface WorkbookCreateResponse {
  id: number;
  name: string;
  capital_paise: number;
}

export interface PortfolioSnapshot {
  workbook_id: number;
  main_capital_paise: number;
  available_paise: number;
}

export interface RunSummary {
  id: number;
  router: string;
  fills: number;
  selected: number;
  returned_paise: number;
}

export interface RunStartRequest {
  capital_paise?: number;
  tickers?: string[];
  strategies?: string[];
  router?: string;
  from_ns?: number;
  to_ns?: number;
  trade_from_ns?: number;
  trade_to_ns?: number;
}

export interface RunStartResponse {
  run_id: number;
  workbook_id: number;
  selected: number;
  skipped: number;
  fills: number;
  returned_paise: number;
  signals: number;
  rejections: number;
}

export interface ContainerRow {
  id: number;
  ticker: string;
  strategy: string;
  mode: string;
  fills: number;
  realized_paise: number;
}

export interface FillRow {
  ticker: string;
  side: string;
  qty: number;
  price_paise: number;
  timestamp_ns: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(body || `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}
