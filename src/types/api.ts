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
  created_at?: string;
}

export interface HistoryListParams {
  from?: string;
  to?: string;
  limit?: number;
  cursor?: number;
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

export interface Instrument {
  ticker: string;
  name: string;
  isin: string;
  exchange: string;
  segment: string;
  lot_size: number;
  tick_size_paise: number;
  instrument_key: string;
  active: boolean;
}

export interface BacktestRow {
  id: number;
  workbook_id: number;
  strategy: string;
  ticker: string;
  capital_paise: number;
  from_ns: number;
  to_ns: number;
  ending_equity_paise: number;
  pnl_paise: number;
  fees_paise: number;
  return_pct_bp: number;
  /** Percent points after costs (API convenience field). */
  return_pct?: number;
  max_drawdown_paise: number;
  fills: number;
  bars: number;
  status: string;
  created_at: string;
}

export interface BacktestStartRequest {
  ticker: string;
  strategy: string;
  capital_paise?: number;
  from_ns: number;
  to_ns: number;
  order_qty?: number;
}

export type ChartResolution = "1m" | "1d" | "1w" | "1M";

export interface OhlcvCandle {
  timestamp_ns: number;
  open_paise: number;
  high_paise: number;
  low_paise: number;
  close_paise: number;
  volume: number;
}

export interface OhlcvResponse {
  ticker: string;
  resolution: ChartResolution | string;
  from: string;
  to: string;
  vendor_fetches: number;
  candles: OhlcvCandle[];
}

/** Layers accepted by GET .../runs/{id}/events?include= */
export type RunEventLayer = "signal" | "rejection" | "fill" | "routing" | "lifecycle";

export interface RunEventSignalData {
  id: number;
  container_id: number;
  ticker: string;
  strategy: string;
  intent_count: number;
  indicators_json: string;
  timestamp_ns: number;
}

export interface RunEventRejectionData {
  id: number;
  container_id: number;
  ticker: string;
  rule: string;
  reason: string;
  timestamp_ns: number;
}

export interface RunEventFillData {
  id: number;
  container_id: number;
  ticker: string;
  side: string;
  qty: number;
  price_paise: number;
  fees_paise: number;
  timestamp_ns: number;
}

export interface RunEventRoutingData {
  id: number;
  ticker: string;
  strategy: string;
  decision: string;
  score_paise: number;
  reason: string;
  timestamp_ns: number;
}

export interface RunEventLifecycleData {
  id: number;
  container_id: number;
  ticker: string;
  event_type: string;
  detail: string;
  timestamp_ns: number;
}

export type RunEvent =
  | { type: "signal"; id: number; timestamp_ns: number; data: RunEventSignalData }
  | { type: "rejection"; id: number; timestamp_ns: number; data: RunEventRejectionData }
  | { type: "fill"; id: number; timestamp_ns: number; data: RunEventFillData }
  | { type: "routing"; id: number; timestamp_ns: number; data: RunEventRoutingData }
  | { type: "lifecycle"; id: number; timestamp_ns: number; data: RunEventLifecycleData };

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
