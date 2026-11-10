export type TF = '1m' | '5m' | '15m' | '1h' | '4h';
export const TFS: TF[] = ['1m', '5m', '15m', '1h', '4h'];
export const TF_MS: Record<TF, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
};
export const TF_LABEL: Record<TF, string> = { '1m': '1d', '5m': '5d', '15m': '15d', '1h': '1s', '4h': '4s' };

export interface Bar {
  t: number; // open time, ms UTC
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type Side = 'long' | 'short';
export type OrderType = 'market' | 'limit' | 'stop';

export interface Order {
  id: string;
  side: Side;
  type: Exclude<OrderType, 'market'>;
  price: number;
  sl?: number;
  tp?: number;
  lots: number;
  createdAt: number;
}

export interface LevelChange { at: number; sl?: number; tp?: number }
export interface Position {
  levels?: LevelChange[];
  id: string;
  side: Side;
  lots: number;
  entry: number;
  sl?: number;
  tp?: number;
  initialSl?: number;
  /** set once the first stop is committed; until then initialSl follows the stop */
  riskLocked?: boolean;
  openedAt: number; // replay ms
  orderType: OrderType;
  shotOpen?: string;
}

export type CloseReason = 'tp' | 'sl' | 'manual' | 'session' | 'violation';

export interface Trade {
  levels?: LevelChange[];
  id: string;
  accountId: string;
  sessionId: string;
  side: Side;
  lots: number;
  entry: number;
  exit: number;
  sl?: number;
  tp?: number;
  initialSl?: number;
  openedAt: number;
  closedAt: number;
  pnl: number;
  r?: number;
  reason: CloseReason;
  orderType: OrderType;
  tf: TF;
  note: string;
  shotOpen?: string;
  shotClose?: string;
  realClosedAt: number; // wall clock
}

export interface Rules {
  target: number; // % profit target (challenge)
  dailyLoss: number; // % of size
  maxLoss: number; // % of size
  minDays: number;
  split: number; // % trader share
  payoutMin: number; // % profit needed to request payout
  /** profit target per step, e.g. [9, 4.5] for a two-step challenge */
  targets?: number[];
  /** a day counts toward minDays only if its realised profit reaches this % of size (0: any traded day) */
  minDayPct?: number;
  /** smallest payout, in trader share dollars */
  payoutMinUsd?: number;
  /** payout provider's percentage fee, charged against the user's reward share */
  payoutFeePct?: number;
  /** commission, % of notional per side */
  commissionPct?: number;
  /** day start reference at 22:00 UTC: higher of equity/balance, or balance only */
  dailyBase?: 'max' | 'balance';
  /** static: fixed floor; trailing: rises with balance, locks at the initial balance */
  maxType?: 'static' | 'trailing';
  /** evaluation: best day may be at most this % of total realised profit */
  consistencyPct?: number;
  /** payout: best day may be at most this % of lifetime realised profit */
  payoutConsistencyPct?: number;
  /** payout must leave this % of the daily drawdown amount above the initial balance */
  payoutBufferPct?: number;
  rulesVersion?: string;
  payoutMinimumDailyPct?: number;
  retainedProfitUsd?: number;
  /** traded days needed since activation / the last payout before a payout */
  payoutMinDays?: number;
}

export interface Payout {
  id: string;
  accountId: string;
  gross: number;
  amount: number;
  at: number;
}

export type Phase = 'challenge' | 'funded';
export type AccountStatus = 'active' | 'violated';

export interface Account {
  id: string;
  no: string;
  size: number;
  phase: Phase;
  status: AccountStatus;
  createdAt: number;
  fundedAt?: number;
  violatedAt?: number;
  violation?: string;
  balance: number;
  rules: Rules;
  tradingDays: string[];
  payouts: Payout[];
  /** challenge step, 0-based */
  step?: number;
  programId?: string;
  programName?: string;
  /** what the trader paid for the account */
  fee?: number;
  archived?: boolean;
  /** realised P&L per prop day (session:day) in the current step, or since funding */
  dayPnl?: Record<string, number>;
  /** highest closed balance in the current step, for trailing drawdown */
  peak?: number;
  /** traded days since activation or the last payout */
  payoutDays?: string[];
}

export type DrawingKind =
  | 'trend' | 'ray' | 'extended' | 'hline' | 'hray' | 'vline' | 'cross'
  | 'channel' | 'regression' | 'pitchfork' | 'fib' | 'rect' | 'longpos' | 'shortpos' | 'measure';
export interface Anchor {
  t: number;
  p: number;
}
export interface Drawing {
  id: string;
  kind: DrawingKind;
  a: Anchor;
  b: Anchor;
  /** third anchor: channel width, pitchfork second pivot, position stop */
  c?: Anchor;
}

export interface SessionRec {
  dataSource?: 'dukascopy-xauusd-bid';
  id: string;
  accountId: string;
  startMs: number;
  clockMs: number;
  startedAt: number;
  endedAt?: number;
  orders: Order[];
  positions: Position[];
  drawings: Drawing[];
  dayStartEquity: number;
  dayKey: string;
  firstPrice?: number;
  lastPrice?: number;
  high?: number;
  low?: number;
}

export const DEFAULT_RULES: Rules = {
  target: 8,
  dailyLoss: 5,
  maxLoss: 10,
  minDays: 3,
  split: 80,
  payoutMin: 1,
};

export const PACKAGES = [5_000, 10_000, 25_000, 50_000, 100_000, 200_000];

/** cTrader XAUUSD contract: 1 lot = 100 oz */
export const CONTRACT = 100;
export const MIN_LOT = 0.01;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
