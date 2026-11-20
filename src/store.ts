import { create } from 'zustand';
import { Feed, randomStart } from './lib/feed';
import { INSTRUMENT_BY_ID, Instrument, InstrumentId, commissionFor, instrumentOf, leverageFor } from './lib/instruments';
import { store as db } from './lib/db';
import { play, configureSound } from './lib/sound';
import { atr } from './lib/indicators';
import { createSetupEngine } from './lib/parcaSetup';
import { createGoldSetupEngine } from './lib/parcaSetupGold';
import type { SetupMark } from './lib/parcaSetup';
import { GOLD_A_SETUP_DEFAULTS, GOLD_SETUP_DEFAULTS, isGoldId, isParcaId, PARCA_CLASSIC_ID, PARCA_GOLD_A_ID, PARCA_GOLD_ID, parcaName } from './lib/parcaVariants';
import type { ParcaId } from './lib/parcaVariants';
import { money0 } from './lib/format';
import { PROGRAMS, payoutNet, propDay, salePrice, splitFor } from './lib/programs';
import { DEFAULT_SPREAD, availableLots, conservativeCandle, entryPrice, equityAt, markPrice, maxLotsFor, riskLots, tradePnl } from './lib/execution';
import { accountLimits, countedDays, maximumLossFloor } from './lib/accountRules';
export { accountLimits, countedDays } from './lib/accountRules';
import type { ActiveInd } from './lib/indicators';
import {
  Account, CONTRACT, CloseReason, DEFAULT_RULES, Drawing, DrawingKind, MIN_LOT, Order, OrderType, Position, Rules,
  SessionRec, SetupRecord, Side, TF, TF_MS, Trade, uid,
} from './lib/types';

// ── module-level, non-serialisable runtime ────────────────────────────────────
let feed: Feed | null = null;
export const getFeed = () => feed;

type Listener = (kind: 'reset' | 'update') => void;
const listeners = new Set<Listener>();
export const marketBus = {
  on(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  emit(kind: 'reset' | 'update') {
    listeners.forEach((l) => l(kind));
  },
};

/** Charts register a screenshot function so the engine can photograph entries and exits. */
export const shooter: { fn: null | (() => string | null) } = { fn: null };
/** Visual effects fired by the engine and drawn by the chart overlay. */
export type Fx = { kind: 'fill' | 'tp' | 'sl' | 'bar'; price: number; at: number };
const fxListeners = new Set<(f: Fx) => void>();
export const fxBus = {
  on(l: (f: Fx) => void) {
    fxListeners.add(l);
    return () => {
      fxListeners.delete(l);
    };
  },
  emit(f: Fx) {
    fxListeners.forEach((l) => l(f));
  },
};

// ── types ─────────────────────────────────────────────────────────────────────
export type View = 'dashboard' | 'new' | 'trade' | 'journal' | 'stats' | 'settings' | 'replay';
export type Tool = 'cursor' | DrawingKind;
export type LineTarget = { kind: 'order' | 'pos' | 'ticket'; id?: string; field: 'entry' | 'sl' | 'tp' };

export interface Ticket {
  side: Side;
  type: OrderType;
  entry: number;
  sl?: number;
  tp?: number;
  riskPct: number;
  manualLots: number;
  useRisk: boolean;
}

export interface Settings {
  rules: Rules;
  sound: boolean;
  volume: number;
  barTick: boolean;
  /** gold ask − bid in dollars; undefined uses DEFAULT_SPREAD */
  spread?: number;
  /** ask − bid per other instrument; the instrument default when missing */
  spreads?: Partial<Record<InstrumentId, number>>;
}

export type Overlay =
  | { kind: 'funded'; account: Account }
  | { kind: 'step'; account: Account }
  | { kind: 'violation'; account: Account; reason: string }
  | { kind: 'payout'; account: Account; amount: number; gross: number }
;

/** Session report shown as a corner card; it never interrupts the screen. */
export interface Notice {
  id: string;
  session: SessionRec;
  trades: Trade[];
  account: Account;
  reason: 'user' | 'violation' | 'funded' | 'step' | 'data';
}

export interface ChartPrefs {
  parcaSetupInitialized?: boolean;
  parcaGoldInitialized?: boolean;
  parcaGoldTuned?: boolean;
  parcaGoldAInitialized?: boolean;
  /** how many chart panes are shown (1, 2, 3, 4, 6, 8) */
  count: number;
  panes: PaneCfg[];
  speed: number;
  speedScaleVersion?: 2;
  /** drawings snap to candle time and OHLC (hold Alt to place freely) */
  magnet?: boolean;
  /** bottom dock: height in px, and whether it is folded to its replay bar */
  dockH?: number;
  dockOpen?: boolean;
  /** how 2+ panes share the space: side by side, stacked, or one large pane beside the rest */
  arrange?: 'cols' | 'rows' | 'focus';
  /** the crosshair of one pane shows the same moment on the others */
  syncCrosshair?: boolean;
  /** right order panel */
  orderOpen?: boolean;
  orderW?: number;
}

export interface PaneView {
  /** rising candles drawn as outlines */
  hollow?: boolean;
  /** Asia / London / New York background bands (default on) */
  bands?: boolean;
  /** grid lines (default on) */
  grid?: boolean;
  /** logarithmic price scale */
  log?: boolean;
  /** keep the newest candle in view as the replay advances (default on) */
  follow?: boolean;
}

export const SPEEDS = [0.5, 1, 2, 4, 8, 16, 32];
export const LAYOUTS = [1, 2, 3, 4, 6, 8];

export interface PaneCfg {
  tf: TF;
  ind: ActiveInd[];
  /** look of this pane; every field defaults to the app's standard */
  view?: PaneView;
}
const PANE_TFS: TF[] = ['5m', '1h', '15m', '4h', '1m', '5m', '15m', '1h'];
const parcaIndicator = (): ActiveInd => ({ uid: uid(), id: PARCA_CLASSIC_ID, params: { pivot: 2, window: 10, zoneAge: 80 }, colors: ['#c9a96e'] });
const parcaGoldIndicator = (): ActiveInd => ({ uid: uid(), id: PARCA_GOLD_ID, params: { ...GOLD_SETUP_DEFAULTS }, colors: ['#e8c46e'] });
const parcaGoldAIndicator = (): ActiveInd => ({ uid: uid(), id: PARCA_GOLD_A_ID, params: { ...GOLD_A_SETUP_DEFAULTS }, colors: ['#f2d58a'] });
const defaultPanes = (): PaneCfg[] => PANE_TFS.map((tf, i) => ({ tf, ind: i === 0 ? [parcaIndicator(), parcaGoldIndicator(), parcaGoldAIndicator()] : [] }));
/** The first pane drives replay steps and trade records. */
export const mainTf = (p: ChartPrefs) => p.panes[0].tf;

interface Live {
  price: number;
  clock: number;
  equity: number;
  floating: number;
  dayLoss: number;
  worstEquity: number;
}

interface State {
  ready: boolean;
  view: View;
  accounts: Account[];
  trades: Trade[];
  sessions: SessionRec[];
  setups: SetupRecord[];
  activeSetupId: string;
  settings: Settings;
  prefs: ChartPrefs;
  session: SessionRec | null;
  loading: { progress: number; error?: string; accountId?: string } | null;
  live: Live;
  playing: boolean;
  seekingSignal: boolean;
  dataWait: boolean;
  tool: Tool;
  ticket: Ticket | null;
  editing: { kind: 'order' | 'pos'; id: string } | null;
  overlay: Overlay | null;
  notices: Notice[];
  replayTradeId: string | null;
  journalTradeId: string | null;
  sessionTrades: Trade[];
  toast: { id: number; text: string; tone: 'neutral' | 'warn' | 'down' } | null;

  boot(): Promise<void>;
  createSetup(name: string, note: string): Promise<void>;
  switchSetup(id: string): Promise<void>;
  go(v: View): void;
  createAccount(size: number, programId?: string): Promise<void>;
  resetAllAccounts(): Promise<void>;
  archiveAccount(id: string, archived: boolean): Promise<void>;
  /** resume the account's open session, or start a new one on `instrument` (gold by default) */
  startSession(accountId: string, instrument?: InstrumentId): Promise<void>;
  endSession(reason?: Notice['reason']): Promise<void>;
  advanceToDayEnd(): Promise<void>;
  /** process every minute up to `target` (replay ms), forward only, with all orders and rules */
  advanceTo(target: number): Promise<void>;
  advanceToNextSignal(): Promise<void>;
  stopSignalSeek(): void;
  stepBar(): void;
  stepMinutes(n: number): void;
  setPlaying(p: boolean): void;
  setPrefs(p: Partial<ChartPrefs>): void;
  setPane(i: number, p: Partial<PaneCfg>): void;
  showPrice: boolean;
  setShowPrice(v: boolean): void;
  /** index of the chart pane shown alone (multi-pane layouts), null = all */
  maxPane: number | null;
  setMaxPane(i: number | null): void;
  setTool(t: Tool): void;
  openTicket(side: Side, type?: OrderType, entry?: number): void;
  updateTicket(p: Partial<Ticket>): void;
  submitTicket(): void;
  cancelTicket(): void;
  cancelOrder(id: string): void;
  selectLine(t: { kind: 'order' | 'pos'; id: string } | null): void;
  setOrderLots(id: string, lots: number): void;
  closePosition(id: string): void;
  moveLine(target: LineTarget, price: number): void;
  clearLevel(target: LineTarget): void;
  placeLevel(target: LineTarget): void;
  commitLine(): void;
  addDrawing(d: Drawing): void;
  updateDrawing(d: Drawing): void;
  removeDrawing(id: string): void;
  clearDrawings(): void;
  requestPayout(accountId: string): Promise<void>;
  dismissOverlay(): void;
  dismissNotice(id: string): void;
  toggleTicketLevel(field: 'sl' | 'tp'): void;
  saveNote(tradeId: string, note: string): Promise<void>;
  saveSettings(s: Partial<Settings>): Promise<void>;
  openReplay(tradeId: string): void;
  openJournal(tradeId: string | null): void;
  showToast(text: string, tone?: 'neutral' | 'warn' | 'down'): void;
}

// ── helpers ───────────────────────────────────────────────────────────────────
const dir = (s: Side) => (s === 'long' ? 1 : -1);
/** Ask − bid in dollars applied to the bid candles. */
export { markPrice };
/** Instrument of the open session; contract size, spread, leverage and commission follow it. */
let inst: Instrument = INSTRUMENT_BY_ID.xauusd;
export const activeInstrument = () => inst;
export const spreadOf = (s: Settings) => (inst.id === 'xauusd' ? s.spread ?? DEFAULT_SPREAD : s.spreads?.[inst.id] ?? inst.spread);
export const pnlOf = (side: Side, entry: number, exit: number, lots: number) => (exit - entry) * dir(side) * lots * inst.contract;
export const riskOf = (entry: number, sl: number | undefined, lots: number) =>
  sl === undefined ? undefined : Math.abs(entry - sl) * lots * inst.contract;
const roundLots = (x: number) => Math.max(MIN_LOT, Math.floor(x / MIN_LOT + 1e-9) * MIN_LOT);
/** XAUUSD gross exposure ceiling: account equity × fixed 15:1 leverage. */
export const GOLD_LEVERAGE = 15;
export const maxGoldLots = (equity: number, price: number, lev = GOLD_LEVERAGE) => maxLotsFor(equity, price, lev, inst.contract);
export const goldMarginRequired = (lots: number, price: number, lev = GOLD_LEVERAGE) => lots * price * inst.contract / lev;

function availableGoldLots(a: Account, s: SessionRec, price: number, excludingOrderId?: string) {
  return availableLots(a.balance, leverageFor(a.rules, inst), s.positions, s.orders, price, excludingOrderId, inst.contract);
}

export function ticketLots(t: Ticket, balance: number, entry = t.entry) {
  if (t.useRisk && t.sl !== undefined) {
    return riskLots(balance * t.riskPct / 100, Math.abs(entry - t.sl), inst.contract);
  }
  return roundLots(t.manualLots);
}

/** Pending orders take their type from the side and where the price sits relative to the market. */
export function deriveType(side: Side, entry: number, bid: number, spread = 0): 'limit' | 'stop' {
  const quote = entryPrice(side, bid, spread);
  return (side === 'long' ? entry < quote : entry > quote) ? 'limit' : 'stop';
}

/** Best day as a % of total realised profit (the firm's consistency score). */
export function consistencyScore(a: Account) {
  const days = Object.values(a.dayPnl ?? {});
  const total = days.reduce((x, y) => x + y, 0);
  if (total <= 0) return 0;
  return (Math.max(...days) / total) * 100;
}

/** Why a payout cannot be requested now, or null. */
export function payoutBlocker(a: Account, openPositions: number): string | null {
  if (a.phase !== 'funded' || a.status !== 'active') return null;
  const lim = accountLimits(a, null);
  if (openPositions) return 'Ödeme için açık pozisyon olmamalı.';
  if (a.balance < lim.payoutAt) return `Ödeme için bakiye en az ${money0(lim.payoutAt)} olmalı.`;
  const need = a.rules.payoutMinDays ?? 0;
  const have = new Set(a.payoutDays ?? []).size;
  if (have < need) return `Ödeme için ${need - have} işlem günü daha gerekli.`;
  const cap = a.rules.payoutConsistencyPct;
  if (cap && consistencyScore(a) > cap) return `Tutarlılık: en iyi gün toplam kârın %${consistencyScore(a).toFixed(0)}’i (sınır %${cap}).`;
  return null;
}

/** Why a reached target has not passed yet, or null when it can pass now. */
export function passBlocker(a: Account, openPositions: number): string | null {
  const lim = accountLimits(a, null);
  if (a.phase !== 'challenge' || a.status !== 'active' || a.balance < lim.target) return null;
  const days = countedDays(a);
  if (days < a.rules.minDays) {
    const left = a.rules.minDays - days;
    return a.rules.minDayPct ? `Hedef tamam · ${left} kârlı gün daha (günde en az %${String(a.rules.minDayPct).replace('.', ',')})` : `Hedef tamam · ${left} işlem günü daha`;
  }
  if (openPositions) return 'Hedef tamam · açık pozisyonları kapat';
  const cap = a.rules.consistencyPct;
  if (cap && consistencyScore(a) > cap) return `Hedef tamam · tutarlılık: en iyi gün kârın %${consistencyScore(a).toFixed(0)}’i (sınır %${cap})`;
  return null;
}

/**
 * Session writes: user actions save at once; replay steps save at most once a second, and the
 * latest state is always flushed (on pause, on leaving the page). Closed trades are written
 * separately and atomically in closePos, so throttling never loses a trade.
 */
let pendingSession: SessionRec | null = null;
let sessionTimer: ReturnType<typeof setTimeout> | undefined;
function writeSession(session: SessionRec) {
  void db.putSession(structuredClone(session)).catch(() =>
    useApp.getState().showToast('Seans kaydedilemedi. Tarayıcı depolamasını kontrol et.', 'warn'));
}
export function flushSession() {
  clearTimeout(sessionTimer);
  sessionTimer = undefined;
  if (pendingSession) writeSession(pendingSession);
  pendingSession = null;
}
function persistSession(session: SessionRec | null, immediate = true) {
  if (!session) return;
  if (immediate) {
    pendingSession = null;
    clearTimeout(sessionTimer);
    sessionTimer = undefined;
    writeSession(session);
    return;
  }
  pendingSession = session;
  if (!sessionTimer) sessionTimer = setTimeout(flushSession, 1000);
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushSession);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushSession());
}

const accountNo = (existing: Account[]) => {
  const n = existing.reduce((m, a) => Math.max(m, parseInt(a.no.replace(/^S2C-/, ''), 10) || 0), 0);
  return `S2C-${n + 1}`;
};

const DEFAULT_PREFS: ChartPrefs = {
  parcaSetupInitialized: true,
  parcaGoldInitialized: true,
  parcaGoldTuned: true,
  parcaGoldAInitialized: true,
  count: 1,
  panes: defaultPanes(),
  speed: 1,
  speedScaleVersion: 2,
  magnet: true,
  dockH: 232,
  dockOpen: true,
  orderOpen: true,
};

function migratePrefs(raw: unknown): ChartPrefs {
  const p = (raw ?? {}) as Partial<ChartPrefs> & { layout?: string; tfA?: TF; tfB?: TF; indA?: ActiveInd[]; indB?: ActiveInd[] };
  const speed = p.speedScaleVersion === 2 ? p.speed ?? 1 : p.speed === undefined ? 1 : Math.min(SPEEDS.length - 1, p.speed + 1);
  if (p.panes && p.panes.length === 8) {
    const panes = p.panes.map((pane, i) => {
      const ind = pane.ind.map((item) => {
        const v = item.params;
        // Gold settings saved before the engulf entry existed: move to the current preset.
        if (item.id === PARCA_GOLD_ID && (v.entry === undefined || v.ema === undefined || v.adx === undefined || v.minP === undefined || v.room === undefined)) return { ...item, params: { ...GOLD_SETUP_DEFAULTS } };
        if (!p.parcaGoldTuned && item.id === PARCA_GOLD_ID && v.pivot === 3 && v.window === 6 &&
          v.zoneAge === 60 && v.minGap === 0.45 && v.biasMode === 2 && v.sweep === 1 && v.session === 1)
          return { ...item, params: { ...v, sweep: 2 } };
        // Migrate only the previous untouched preset; keep deliberate user settings.
        if (item.id !== 'parca-setup' || v.pivot !== 2 || v.window !== 8 || v.zoneAge !== 80 ||
          (v.minGap !== undefined && v.minGap !== 0.3) ||
          (v.biasMode !== undefined && v.biasMode !== 2) ||
          (v.sweep !== undefined && v.sweep !== 0) ||
          (v.session !== undefined && v.session !== 1)) return item;
        return { ...item, params: { ...v, window: 10, minGap: 0.25 } };
      });
      if (i === 0 && !p.parcaSetupInitialized && !ind.some((item) => item.id === PARCA_CLASSIC_ID)) ind.push(parcaIndicator());
      if (i === 0 && !p.parcaGoldInitialized && !p.panes!.some((other) => other.ind.some((item) => item.id === PARCA_GOLD_ID))) ind.push(parcaGoldIndicator());
      if (i === 0) for (let k = 0; k < ind.length; k++) if (ind[k].id === PARCA_GOLD_A_ID && (ind[k].params.minP === undefined || ind[k].params.room === undefined)) ind[k] = { ...ind[k], params: { ...GOLD_A_SETUP_DEFAULTS } };
      if (i === 0 && !p.parcaGoldAInitialized && !p.panes!.some((other) => other.ind.some((item) => item.id === PARCA_GOLD_A_ID))) ind.push(parcaGoldAIndicator());
      return { ...pane, ind };
    });
    return { ...DEFAULT_PREFS, ...p, panes, speed: panes[0].tf === '1m' ? Math.min(speed, 3) : speed,
      speedScaleVersion: 2, parcaSetupInitialized: true, parcaGoldInitialized: true, parcaGoldTuned: true, parcaGoldAInitialized: true };
  }
  const panes = defaultPanes();
  if (p.tfA) panes[0] = { tf: p.tfA, ind: [...(p.indA ?? []), parcaIndicator(), parcaGoldIndicator()] };
  if (p.tfB) panes[1] = { tf: p.tfB, ind: p.indB ?? [] };
  return { ...DEFAULT_PREFS, count: p.layout === 'dual' ? 2 : 1, panes, speed: panes[0].tf === '1m' ? Math.min(speed, 3) : speed,
    speedScaleVersion: 2,
    parcaSetupInitialized: true, parcaGoldInitialized: true, parcaGoldTuned: true, parcaGoldAInitialized: true };
}

let warned = { day: false, max: false };
let lastTicket = { riskPct: 1, manualLots: 0.1, useRisk: false, withSl: true, withTp: true };

/** 1.5 × ATR(14) of the main chart: where a fresh stop is first drawn. */
export function defaultDistance() {
  const f = getFeed();
  if (!f) return 1;
  const bars = f.bars(mainTf(useApp.getState().prefs));
  return (atr(bars.slice(-200), 14).at(-1) || f.price * 0.002) * 1.5;
}
let playRaf = 0;

// ── store ─────────────────────────────────────────────────────────────────────
export const useApp = create<State>((set, get) => {
  const setupWatchers = new Map<string, { engine: ReturnType<typeof createSetupEngine>; lastSignalAt: number }>();
  /** Check only completed chart candles, using the same indicator engine as the chart. */
  const scanSetupSignals = (prime = false): { mark: SetupMark; id: ParcaId } | null => {
    if (!feed || !get().session) return null;
    const { panes, count } = get().prefs;
    const clock = feed.clock;
    const previousClock = feed.ci > 0 ? feed.minutes[feed.ci - 1].t + 60_000 : clock - 60_000;
    const active = panes.slice(0, count).flatMap((pane, i) => pane.ind
      .filter((ind) => isParcaId(ind.id) && !ind.hidden)
      .map((ind) => ({ pane, ind, i })))
      .filter(({ pane }) => prime || Math.floor(clock / TF_MS[pane.tf]) > Math.floor(previousClock / TF_MS[pane.tf]));
    if (!active.length) return null;
    const days = feed.days();
    const series = { '5m': feed.bars('5m'), '15m': feed.bars('15m'), '1h': feed.bars('1h'), '4h': feed.bars('4h') };
    for (const { pane, ind, i } of active) {
      const key = `${i}|${pane.tf}|${ind.uid}|${JSON.stringify(ind.params)}`;
      let watcher = setupWatchers.get(key);
      const newWatcher = !watcher;
      if (!watcher) {
        watcher = { engine: isGoldId(ind.id) ? createGoldSetupEngine(pane.tf, ind.params, ind.id as ParcaId) : createSetupEngine(pane.tf, ind.params), lastSignalAt: -Infinity };
        setupWatchers.set(key, watcher);
      }
      const result = watcher.engine({ bars: feed.bars(pane.tf), clock, days, series });
      const signal = [...result.marks].reverse().find((mark) => mark.kind === 'signal');
      if (!signal) continue;
      const previous = watcher.lastSignalAt;
      watcher.lastSignalAt = signal.t;
      if (!prime && !newWatcher && signal.t > previous && signal.t + TF_MS[pane.tf] > previousClock && signal.t + TF_MS[pane.tf] <= clock) return { mark: signal, id: ind.id as ParcaId };
    }
    return null;
  };
  // pending screenshot jobs, executed after the chart has drawn the new bar
  const shotJobs: { kind: 'open' | 'close'; posId?: string; tradeId?: string }[] = [];
  const runShots = () => {
    if (!shotJobs.length) return;
    setTimeout(() =>
      requestAnimationFrame(async () => {
        const jobs = shotJobs.splice(0);
        for (const j of jobs) {
          const url = shooter.fn?.();
          if (!url) continue;
          const id = uid();
          await db.putShot(id, url);
          if (j.kind === 'open' && j.posId) {
            const s = get().session;
            const p = s?.positions.find((x) => x.id === j.posId);
            if (p && s) { p.shotOpen = id; persistSession(s, true); }
            const t = get().trades.find((x) => x.id === j.posId);
            if (t && !t.shotOpen) {
              t.shotOpen = id;
              db.putTrade(t);
            }
          }
          if (j.kind === 'close' && j.tradeId) {
            const t = get().trades.find((x) => x.id === j.tradeId);
            if (t) {
              t.shotClose = id;
              await db.putTrade(t);
            }
          }
        }
        set({ trades: [...get().trades] });
      }),
    180);
  };

  const account = () => {
    const s = get().session;
    return s ? get().accounts.find((a) => a.id === s.accountId) ?? null : null;
  };

  const saveAccount = (a: Account) => {
    db.putAccount(a);
    set({ accounts: get().accounts.map((x) => (x.id === a.id ? { ...a } : x)) });
  };

  const computeLive = (): Live => {
    const s = get().session;
    const a = account();
    if (!feed || !s || !a) return get().live;
    const price = feed.price;
    const sp = spreadOf(get().settings);
    const floating = s.positions.reduce((acc, p) => acc + pnlOf(p.side, p.entry, markPrice(p.side, price, sp), p.lots), 0);
    const equity = equityAt(a.balance, s.positions, price, sp, commissionFor(a.rules, inst), inst.contract);
    return {
      price,
      clock: feed.clock,
      equity,
      floating,
      dayLoss: Math.max(0, s.dayStartEquity - equity),
      worstEquity: get().live.worstEquity,
    };
  };

  const closePos = (p: Position, exit: number, reason: CloseReason, at: number) => {
    const s = get().session!;
    const a = account()!;
    const pnl = tradePnl(p, exit, commissionFor(a.rules, inst), inst.contract);
    const risk = riskOf(p.entry, p.initialSl, p.lots);
    const dk = `${s.id}:${propDay(at - 60_000)}`;
    a.dayPnl = { ...(a.dayPnl ?? {}), [dk]: (a.dayPnl?.[dk] ?? 0) + pnl };
    const trade: Trade = {
      id: p.id,
      instrument: inst.id,
      setupId: get().activeSetupId,
      accountId: a.id,
      sessionId: s.id,
      side: p.side,
      lots: p.lots,
      entry: p.entry,
      exit,
      sl: p.sl,
      tp: p.tp,
      initialSl: p.initialSl,
      levels: p.levels,
      openedAt: p.openedAt,
      closedAt: at,
      pnl,
      r: risk ? pnl / risk : undefined,
      reason,
      orderType: p.orderType,
      tf: mainTf(get().prefs),
      note: get().trades.find((t) => t.id === p.id)?.note ?? '',
      shotOpen: p.shotOpen,
      realClosedAt: Date.now(),
    };
    s.positions = s.positions.filter((x) => x.id !== p.id);
    a.balance += pnl;
    a.peak = Math.max(a.peak ?? a.size, a.balance);
    s.clockMs = at;
    void db.commitClose(a, s, trade).catch(() => get().showToast('İşlem kaydedilemedi. Verilerini kontrol edip yedek al.', 'warn'));
    set({
      trades: [...get().trades.filter((t) => t.id !== trade.id), trade],
      sessionTrades: [...get().sessionTrades, trade],
    });
    shotJobs.push({ kind: 'close', tradeId: trade.id });
    if (reason === 'tp') {
      play('tp');
      fxBus.emit({ kind: 'tp', price: exit, at });
    } else if (reason === 'sl') {
      play('sl');
      fxBus.emit({ kind: 'sl', price: exit, at });
    }
    return trade;
  };

  const openPos = (side: Side, lots: number, entry: number, sl: number | undefined, tp: number | undefined, type: OrderType, at: number) => {
    const s = get().session!;
    const a = account()!;
    const p: Position = { id: uid(), side, lots, entry, sl, tp, levels: [{ at, sl, tp }], initialSl: sl, riskLocked: sl !== undefined, openedAt: at, orderType: type };
    s.positions.push(p);
    const key = `${s.id}:${propDay(at)}`;
    if (!a.tradingDays.includes(key)) a.tradingDays.push(key);
    if (a.phase === 'funded') a.payoutDays = [...new Set([...(a.payoutDays ?? []), key])];
    saveAccount(a);
    shotJobs.push({ kind: 'open', posId: p.id });
    play('fill');
    fxBus.emit({ kind: 'fill', price: entry, at });
    return p;
  };

  const flagViolation = (a: Account, s: SessionRec, breach: { floor: 'day' | 'max'; equity: number; limit: number; crossing?: boolean }) => {
    s.orders = [];
    a.status = 'violated';
    a.violatedAt = Date.now();
    const daily = breach.floor === 'day';
    const rule = daily ? `Günlük zarar limiti (%${a.rules.dailyLoss})` : `Toplam zarar limiti (%${a.rules.maxLoss})`;
    a.violation = breach.crossing ? `${rule} mum içi senaryoda aşıldı.` :
      `${rule} ${money0(breach.limit - breach.equity)} aşıldı.`;
    saveAccount(a);
    play('violation');
  };

  /** A manual action changes equity at the already visible quote, without replaying its candle. */
  const checkAtQuote = (a: Account, s: SessionRec) => {
    if (!feed) return false;
    const bid = feed.price;
    const spread = spreadOf(get().settings);
    const equity = equityAt(a.balance, s.positions, bid, spread, commissionFor(a.rules, inst), inst.contract);
    const live = computeLive();
    set({ live: { ...live, worstEquity: Math.min(live.worstEquity, equity) } });
    const { dayFloor, maxFloor } = accountLimits(a, s);
    const limit = Math.max(dayFloor, maxFloor);
    if (equity >= limit - 1e-8) return false;
    for (const p of [...s.positions]) closePos(p, markPrice(p.side, bid, spread), 'violation', feed.clock);
    flagViolation(a, s, { floor: dayFloor >= maxFloor ? 'day' : 'max', equity, limit });
    return true;
  };

  /** Process one revealed minute: fills, exits, day roll, rules. Returns false when the session ended. */
  const processMinute = (): boolean => {
    if (!feed) return false;
    const s = get().session;
    const a = account();
    if (!s || !a) return false;
    const m = feed.current;
    const at = feed.clock;
    const sp = spreadOf(get().settings);

    // day roll
    const dk = propDay(m.t);
    if (dk !== s.dayKey) {
      const openingEquity = equityAt(a.balance, s.positions, m.o, sp, commissionFor(a.rules, inst), inst.contract);
      s.dayKey = dk;
      s.dayStartEquity = a.rules.dailyBase === 'balance' ? a.balance : Math.max(a.balance, openingEquity);
      warned = { day: false, max: false };
    }
    s.high = Math.max(s.high ?? m.h, m.h);
    s.low = Math.min(s.low ?? m.l, m.l);
    s.lastPrice = m.c;

    const lim = accountLimits(a, s);
    const outcome = conservativeCandle({
      balance: a.balance, peak: a.peak ?? a.size, positions: s.positions, orders: s.orders,
      spread: sp, commissionPct: commissionFor(a.rules, inst), leverage: leverageFor(a.rules, inst), contract: inst.contract,
      dayFloor: lim.dayFloor, maxFloor: peak => maximumLossFloor(a, peak),
    }, m);
    const filled = new Map<string, Position>();
    for (const event of outcome.events) {
      if (event.kind === 'exit') {
        const p = filled.get(event.id) ?? s.positions.find(p => p.id === event.id);
        if (p) closePos(p, event.price, event.reason, at);
        continue;
      }
      const { order } = event;
      s.orders = s.orders.filter(o => o.id !== order.id);
      if (event.kind === 'cancel') {
        get().showToast(`Emir iptal: ${leverageFor(a.rules, inst)}× kaldıraçta kullanılabilir miktar ${event.allowed.toFixed(2)} lot.`, 'warn');
        continue;
      }
      const p = openPos(order.side, order.lots, event.price, order.sl, order.tp, order.type, m.t);
      filled.set(order.id, p);
      if (get().editing?.id === order.id) set({ editing: { kind: 'pos', id: p.id } });
    }
    const { worst, breach } = outcome;
    const live = get().live;
    set({ live: { ...live, worstEquity: Math.min(live.worstEquity, worst) } });
    if (breach) {
      flagViolation(a, s, breach);
      get().endSession('violation');
      return false;
    }
    // warnings at 80% of a limit
    const dayRoom = s.dayStartEquity - lim.dayFloor;
    if (!warned.day && dayRoom > 0 && s.dayStartEquity - worst >= dayRoom * 0.8) {
      warned.day = true;
      play('warn');
      get().showToast('Günlük zarar limitinin %80’ine ulaştın.', 'warn');
    }
    const maxRoom = a.size - lim.maxFloor;
    if (!warned.max && a.size - worst >= maxRoom * 0.8) {
      warned.max = true;
      play('warn');
      get().showToast('Toplam zarar limitinin %80’ine ulaştın.', 'warn');
    }

    if (tryPass()) return false;
    return true;
  };

  /** Complete the current step when its target, days and flat book are all met. */
  const tryPass = (): boolean => {
    const s = get().session;
    const a = account();
    if (!s || !a || a.phase !== 'challenge' || a.status !== 'active') return false;
    const lim = accountLimits(a, s);
    if (a.balance < lim.target || s.positions.length || countedDays(a) < a.rules.minDays) return false;
    if (a.rules.consistencyPct && consistencyScore(a) > a.rules.consistencyPct) return false;
    s.orders = [];
    const last = lim.step >= lim.steps - 1;
    a.balance = a.size;
    a.tradingDays = [];
    a.dayPnl = {};
    a.peak = a.size;
    a.payoutDays = [];
    if (last) {
      a.phase = 'funded';
      a.fundedAt = Date.now();
    } else {
      a.step = lim.step + 1;
    }
    saveAccount(a);
    play('funded');
    get().endSession(last ? 'funded' : 'step');
    return true;
  };

  const afterSteps = (revealed: number) => {
    if (!revealed) return;
    const s = get().session!;
    if (feed) s.clockMs = feed.clock;
    set({ live: computeLive(), session: { ...s } });
    marketBus.emit('update');
    runShots();
    persistSession(get().session, false);
  };

  return {
    ready: false,
    view: 'dashboard',
    accounts: [],
    trades: [],
    sessions: [],
    setups: [],
    activeSetupId: '',
    settings: { rules: DEFAULT_RULES, sound: true, volume: 0.6, barTick: false },
    prefs: DEFAULT_PREFS,
    session: null,
    loading: null,
    live: { price: 0, clock: 0, equity: 0, floating: 0, dayLoss: 0, worstEquity: Infinity },
    playing: false,
    seekingSignal: false,
    dataWait: false,
    tool: 'cursor',
    ticket: null,
    editing: null,
    overlay: null,
    notices: [],
    showPrice: false,
    maxPane: null,
    replayTradeId: null,
    journalTradeId: null,
    sessionTrades: [],
    toast: null,

    async boot() {
      const [allAccounts, allTrades, allSessions, storedSetups, activeSetup, settings, prefs] = await Promise.all([
        db.accounts(),
        db.trades(),
        db.sessions(),
        db.setups(),
        db.kv<string>('activeSetupId'),
        db.kv<Settings>('settings'),
        db.kv<ChartPrefs>('prefs'),
      ]);
      let setups = storedSetups;
      if (!setups.length) {
        const legacy: SetupRecord = { id: 'setup-default', name: 'İlk kurulum', note: 'Uygulamanın ilk çalışma alanı.', createdAt: Date.now() };
        setups = [legacy];
        await db.putSetup(legacy);
      }
      const legacySetupId = setups[0].id;
      const accountMap = new Map(allAccounts.map((a) => [a.id, a]));
      for (const a of allAccounts) if (!a.setupId || !setups.some((x) => x.id === a.setupId)) { a.setupId = legacySetupId; await db.putAccount(a); }
      for (const s of allSessions) if (!s.setupId || !setups.some((x) => x.id === s.setupId)) { s.setupId = accountMap.get(s.accountId)?.setupId ?? legacySetupId; await db.putSession(s); }
      for (const t of allTrades) if (!t.setupId || !setups.some((x) => x.id === t.setupId)) { t.setupId = accountMap.get(t.accountId)?.setupId ?? legacySetupId; await db.putTrade(t); }
      const selectedSetupId = setups.some((x) => x.id === activeSetup) ? activeSetup! : legacySetupId;
      if (selectedSetupId !== activeSetup) await db.putKv('activeSetupId', selectedSetupId);
      const accounts = allAccounts.filter((a) => a.setupId === selectedSetupId);
      const trades = allTrades.filter((t) => t.setupId === selectedSetupId);
      const sessions = allSessions.filter((s) => s.setupId === selectedSetupId);
      if (accounts.some((a) => /^S2C-\d{6}$/.test(a.no))) {
        [...accounts]
          .sort((x, y) => x.createdAt - y.createdAt)
          .forEach((a, i) => {
            a.no = `S2C-${i + 1}`;
            db.putAccount(a);
          });
      }
      const st = { ...get().settings, ...(settings ?? {}) };
      configureSound({ enabled: st.sound, volume: st.volume, barTick: st.barTick });
      set({
        ready: true,
        setups,
        activeSetupId: selectedSetupId,
        accounts: accounts.sort((a, b) => b.createdAt - a.createdAt),
        trades,
        sessions,
        settings: st,
        prefs: migratePrefs(prefs),
      });
      let last: string | null = null;
      try {
        last = localStorage.getItem('s2c:view');
      } catch {
        last = null;
      }
      const open = sessions.find((x) => !x.endedAt && accounts.some((a) => a.id === x.accountId && a.status === 'active'));
      if (last === 'trade' && open) await get().startSession(open.accountId);
    },

    go(view) {
      if (view !== 'trade') { get().setPlaying(false); get().stopSignalSeek(); }
      set({ view });
      try {
        localStorage.setItem('s2c:view', view);
      } catch {
        /* storage unavailable: start on the dashboard next time */
      }
    },

    async createSetup(name, note) {
      const cleanName = name.trim();
      if (!cleanName) { get().showToast('Setup klasörüne bir isim ver.', 'warn'); return; }
      if (get().session) await get().endSession('user');
      const now = Date.now();
      const setups = get().setups.map((x) => x.id === get().activeSetupId ? { ...x, archivedAt: now } : x);
      const fresh: SetupRecord = { id: uid(), name: cleanName, note: note.trim(), createdAt: now };
      await db.putSetup(setups.find((x) => x.id === get().activeSetupId)!);
      await db.putSetup(fresh);
      await db.putKv('activeSetupId', fresh.id);
      set({ setups: [...setups, fresh], activeSetupId: fresh.id });
      location.reload();
    },

    async switchSetup(id) {
      if (id === get().activeSetupId || !get().setups.some((x) => x.id === id)) return;
      if (get().session) await get().endSession('user');
      await db.putKv('activeSetupId', id);
      location.reload();
    },

    async createAccount(size, programId) {
      const prog = PROGRAMS.find((p) => p.id === programId);
      const a: Account = {
        id: uid(),
        setupId: get().activeSetupId,
        no: accountNo(get().accounts),
        size,
        phase: 'challenge',
        status: 'active',
        createdAt: Date.now(),
        balance: size,
        rules: { ...(prog ? prog.rules : get().settings.rules) },
        tradingDays: [],
        payouts: [],
        step: 0,
        programId: prog?.id ?? 'custom',
        programName: prog?.name ?? 'Özel program',
        fee: prog ? salePrice(prog.prices[size] ?? 0, prog.discount) : 0,
        dayPnl: {},
      };
      await db.putAccount(a);
      set({ accounts: [a, ...get().accounts] });
      play('place');
      await get().startSession(a.id);
    },

    async resetAllAccounts() {
      get().setPlaying(false);
      get().stopSignalSeek();
      cancelAnimationFrame(playRaf);
      await db.clearAllAccountData();
      feed = null;
      setupWatchers.clear();
      set({
        accounts: [],
        sessions: [],
        trades: [],
        session: null,
        sessionTrades: [],
        ticket: null,
        editing: null,
        loading: null,
        live: { price: 0, clock: 0, equity: 0, floating: 0, dayLoss: 0, worstEquity: Infinity },
        overlay: null,
        notices: [],
        replayTradeId: null,
        journalTradeId: null,
      });
      marketBus.emit('reset');
    },

    async startSession(accountId, instrument = 'xauusd') {
      const a = get().accounts.find((x) => x.id === accountId);
      if (!a || a.status !== 'active') return;
      if (get().session && get().session!.accountId !== accountId) await get().endSession('user');
      let s = get().sessions.find((x) => x.accountId === accountId && !x.endedAt) ?? null;
      const fresh = !s;
      if (!s) {
        const start = randomStart(instrument);
        s = {
          id: uid(),
          setupId: get().activeSetupId,
          accountId,
          dataSource: `dukascopy-${instrument}-bid`,
          instrument,
          startMs: start,
          clockMs: start,
          startedAt: Date.now(),
          orders: [],
          positions: [],
          drawings: [],
          dayStartEquity: a.balance,
          dayKey: propDay(start),
        };
      }
      set({ view: 'trade', loading: { progress: 0, accountId }, session: null, ticket: null, tool: 'cursor', playing: false, seekingSignal: false, showPrice: false });
      try {
        localStorage.setItem('s2c:view', 'trade');
      } catch {
        /* ignore */
      }
      try {
        inst = instrumentOf(s);
        feed = await Feed.create(s.startMs, s.clockMs, (p) => set({ loading: { progress: p, accountId } }), inst.id);
      } catch {
        set({ loading: { progress: 0, accountId, error: 'Piyasa verisi alınamadı veya doğrulanamadı. Bağlantını kontrol edip tekrar dene.' } });
        return;
      }
      if (fresh) {
        s.firstPrice = feed.price;
        s.high = feed.price;
        s.low = feed.price;
        await db.putSession(s);
        set({ sessions: [...get().sessions, s] });
      }
      warned = { day: false, max: false };
      set({
        session: s,
        loading: null,
        sessionTrades: get().trades.filter((t) => t.sessionId === s!.id),
        live: { price: feed.price, clock: feed.clock, equity: a.balance, floating: 0, dayLoss: 0, worstEquity: Infinity },
      });
      set({ live: computeLive() });
      if (feed.hasGaps) get().showToast('Veride boşluklar var; piyasa arası veya eksik mum olabilir.', 'warn');
      marketBus.emit('reset');
    },

    async endSession(reason = 'user') {
      const s = get().session;
      const a = account();
      get().setPlaying(false);
      if (!s || !a || !feed) return;
      if (reason === 'user' || reason === 'data') {
        if (checkAtQuote(a, s)) reason = 'violation';
        for (const p of [...s.positions]) closePos(p, markPrice(p.side, feed.price, spreadOf(get().settings)), 'session', feed.clock);
        s.orders = [];
        saveAccount(a);
        if (reason !== 'violation' && checkAtQuote(a, s)) reason = 'violation';
        if (reason !== 'violation' && tryPass()) return;
      }
      s.clockMs = feed.clock;
      s.endedAt = Date.now();
      await db.putSession(s);
      runShots();
      const trades = get().trades.filter((t) => t.sessionId === s.id);
      let overlay: Overlay | null = null;
      if (reason === 'violation') overlay = { kind: 'violation', account: { ...a }, reason: a.violation ?? '' };
      if (reason === 'funded') overlay = { kind: 'funded', account: { ...a } };
      if (reason === 'step') overlay = { kind: 'step', account: { ...a } };
      const notice: Notice = { id: uid(), session: { ...s }, trades, account: { ...a }, reason };
      // screenshots are taken from the chart, so let them finish before it unmounts
      await new Promise((r) => setTimeout(r, 400));
      feed = null;
      set({
        sessions: get().sessions.map((x) => (x.id === s.id ? { ...s } : x)),
        session: null,
        ticket: null,
    editing: null,
        sessionTrades: [],
        overlay,
        notices: [...get().notices, notice].slice(-3),
      });
      if (get().view === 'trade') get().go('dashboard');
      if (!overlay) play('print');
    },

    async advanceToDayEnd() {
      const initial = get().session;
      if (!initial || !feed || get().playing || get().seekingSignal || get().dataWait) return;
      const dayKey = initial.dayKey;
      let revealed = 0;
      set({ dataWait: true });
      for (let i = 0; i < 7 * 24 * 60; i++) {
        const current = get().session;
        if (!current || current.id !== initial.id || current.dayKey !== dayKey || !feed) break;
        const bar = feed.step();
        if (!bar) {
          if (feed.loadError) {
            get().showToast('Gün sonuna ilerlenemedi; piyasa verisi yüklenemedi.', 'warn');
            break;
          }
          if (feed.isLoading) {
            await feed.waitForLoading();
            continue;
          }
          if (feed.exhausted) {
            get().showToast('Gün sonuna yetecek tarihsel mum kalmadı.', 'warn');
            break;
          }
          continue;
        }
        revealed++;
        if (!processMinute()) break;
        if (revealed >= 64) {
          afterSteps(revealed);
          revealed = 0;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      if (revealed && get().session?.id === initial.id) afterSteps(revealed);
      set({ dataWait: false });
      if (get().session?.id === initial.id && get().session!.dayKey !== dayKey)
        get().showToast('Prop günü tamamlandı; günlük limit yeni güne göre yenilendi.');
      else if (get().session?.id === initial.id && get().session!.dayKey === dayKey && feed?.exhausted)
        get().showToast('Gün sonuna ulaşmak için daha fazla piyasa verisi gerekiyor.', 'warn');
    },

    async advanceTo(target) {
      const initial = get().session;
      if (!initial || !feed || get().playing || get().seekingSignal || get().dataWait || target <= feed.clock) return;
      let revealed = 0;
      set({ dataWait: true });
      // a week of minutes at most: the strip never asks for more than one prop day
      for (let i = 0; i < 7 * 24 * 60 && feed && feed.clock < target; i++) {
        const current = get().session;
        if (!current || current.id !== initial.id) break;
        const bar = feed.step();
        if (!bar) {
          if (feed.loadError) { get().showToast('İlerlenemedi; piyasa verisi yüklenemedi.', 'warn'); break; }
          if (feed.isLoading) { await feed.waitForLoading(); continue; }
          if (feed.exhausted) { get().showToast('Bu ana kadar yetecek tarihsel mum kalmadı.', 'warn'); break; }
          continue;
        }
        revealed++;
        if (!processMinute()) break;
        if (revealed >= 64) {
          afterSteps(revealed);
          revealed = 0;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      if (revealed && get().session?.id === initial.id) afterSteps(revealed);
      set({ dataWait: false });
    },

    async advanceToNextSignal() {
      const initial = get().session;
      if (!initial || !feed || get().playing || get().seekingSignal || get().dataWait) return;
      setupWatchers.clear();
      scanSetupSignals(true);
      set({ seekingSignal: true });
      let revealed = 0;
      let found = false;
      let reason = 'Bir haftalık veride yeni Parça sinyali bulunamadı.';
      for (let i = 0; i < 7 * 24 * 60; i++) {
        if (!get().seekingSignal || get().session?.id !== initial.id || !feed) break;
        if (!feed.step()) {
          if (feed.loadError) { reason = 'Piyasa verisi yüklenemedi; sinyal araması durdu.'; break; }
          if (feed.isLoading) { await feed.waitForLoading(); continue; }
          if (feed.exhausted) { reason = 'Tarihsel verinin sonuna ulaşıldı.'; break; }
          continue;
        }
        revealed++;
        if (!processMinute()) break;
        const hit = scanSetupSignals();
        if (hit) {
          found = true;
          if (get().session?.id === initial.id) afterSteps(revealed);
          revealed = 0;
          get().showToast(`Parça ${parcaName(hit.id)} ${hit.mark.side === 'long' ? 'AL' : 'SAT'} sinyali bulundu; işlem açabilirsin.`);
          break;
        }
        if (revealed >= 240) {
          afterSteps(revealed);
          revealed = 0;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      if (revealed && get().session?.id === initial.id) afterSteps(revealed);
      const cancelled = !get().seekingSignal;
      set({ seekingSignal: false });
      if (!found && !cancelled && get().session?.id === initial.id) get().showToast(reason, 'warn');
    },

    stopSignalSeek() {
      if (get().seekingSignal) set({ seekingSignal: false });
    },

    stepMinutes(n) {
      if (!feed || !get().session) return;
      let revealed = 0;
      for (let i = 0; i < n; i++) {
        if (!feed.step()) {
          if (feed.loadError) { feed.loadError = false; get().setPlaying(false); get().showToast('Veri yüklenemedi. Sonraki mum düğmesiyle tekrar deneyebilirsin.', 'warn'); }
          if (feed.exhausted) {
            get().endSession('data');
            return;
          }
          set({ dataWait: true });
          break;
        }
        revealed++;
        if (!processMinute()) return;
      }
      if (revealed) set({ dataWait: false });
      afterSteps(revealed);
    },

    stepBar() {
      if (!feed || !get().session) return;
      const ms = TF_MS[mainTf(get().prefs)];
      let revealed = 0;
      let signal: { mark: SetupMark; id: ParcaId } | null = null;
      for (let guard = 0; guard < 2000; guard++) {
        if (!feed.step()) {
          if (feed.loadError) { feed.loadError = false; get().setPlaying(false); get().showToast('Veri yüklenemedi. Sonraki mum düğmesiyle tekrar deneyebilirsin.', 'warn'); }
          if (feed.exhausted) {
            get().endSession('data');
            return;
          }
          set({ dataWait: true });
          break;
        }
        revealed++;
        if (!processMinute()) return;
        if (get().playing) {
          signal = scanSetupSignals();
          if (signal) break;
        }
        const next = feed.minutes[feed.ci + 1];
        if (!next || Math.floor(next.t / ms) !== Math.floor(feed.current.t / ms)) break;
      }
      if (revealed) {
        set({ dataWait: false });
        if (!get().playing || SPEEDS[get().prefs.speed] <= 4) {
          play('bar');
          fxBus.emit({ kind: 'bar', price: feed.price, at: feed.clock });
        }
      }
      afterSteps(revealed);
      if (signal) {
        get().setPlaying(false);
        get().showToast(`Parça ${parcaName(signal.id)} ${signal.mark.side === 'long' ? 'AL' : 'SAT'} sinyali${signal.mark.prob !== undefined ? ` (1R olasılığı %${Math.round(signal.mark.prob * 100)})` : ''}: oynatma durdu. İşlemi sağ panelden açabilirsin.`);
      }
    },

    setPlaying(p) {
      cancelAnimationFrame(playRaf);
      if (p) get().stopSignalSeek();
      set({ playing: p });
      if (!p) {
        flushSession();
        return;
      }
      setupWatchers.clear();
      scanSetupSignals(true);
      let last = performance.now();
      let acc = 0;
      const loop = (now: number) => {
        if (!get().playing) return;
        const dt = Math.min(0.25, (now - last) / 1000);
        last = now;
        const speed = SPEEDS[get().prefs.speed] ?? 1;
        acc += dt * (mainTf(get().prefs) === '1m' ? Math.min(speed, 4) : speed);
        let guard = 0;
        while (acc >= 1 && guard++ < 64) {
          acc -= 1;
          get().stepBar();
          if (!get().playing) return;
          if (!get().session || get().overlay?.kind === 'violation' || get().overlay?.kind === 'funded' || get().overlay?.kind === 'step') {
            set({ playing: false });
            return;
          }
        }
        playRaf = requestAnimationFrame(loop);
      };
      playRaf = requestAnimationFrame(loop);
    },

    setPrefs(p) {
      const prefs = { ...get().prefs, ...p };
      set({ prefs });
      db.putKv('prefs', prefs);
    },

    setPane(i, p) {
      if (get().playing && (p.tf || p.ind)) get().setPlaying(false);
      if (get().seekingSignal && (p.tf || p.ind)) get().stopSignalSeek();
      const panes = get().prefs.panes.map((x, j) => (j === i ? { ...x, ...p } : x));
      get().setPrefs({ panes, ...(i === 0 && p.tf === '1m' && get().prefs.panes[0].tf !== '1m' ? { speed: 1 } : {}) });
    },

    setShowPrice(v) {
      set({ showPrice: v });
    },

    setMaxPane(i) {
      set({ maxPane: i });
    },

    setTool(tool) {
      set({ tool });
    },

    openTicket(side, type = 'market', entry) {
      const a = account();
      if (!feed || !a) return;
      const price = feed.price;
      const e = type === 'market' || entry === undefined ? price : entry;
      const dist = defaultDistance();
      const t: Ticket = {
        side,
        type: type === 'market' ? 'market' : deriveType(side, e, price, spreadOf(get().settings)),
        entry: e,
        sl: lastTicket.withSl ? e - dir(side) * dist : undefined,
        tp: lastTicket.withTp ? e + dir(side) * dist * 2 : undefined,
        riskPct: lastTicket.riskPct,
        manualLots: lastTicket.manualLots,
        useRisk: lastTicket.useRisk,
      };
      set({ ticket: t, editing: null });
    },

    updateTicket(p) {
      const t = get().ticket;
      if (!t) return;
      const next = { ...t, ...p };
      if (p.type === 'market' && feed) next.entry = feed.price;
      lastTicket = { ...lastTicket, riskPct: next.riskPct, manualLots: next.manualLots, useRisk: next.useRisk };
      if (p.side && p.side !== t.side) {
        // mirror the stop and target around where the order would actually enter
        const base = t.type === 'market' && feed ? feed.price : t.entry;
        next.entry = base;
        if (t.sl !== undefined) next.sl = base - (t.sl - base);
        if (t.tp !== undefined) next.tp = base - (t.tp - base);
        if (next.type !== 'market' && feed) next.type = deriveType(next.side, next.entry, feed.price, spreadOf(get().settings));
      }
      set({ ticket: next });
    },

    submitTicket() {
      const t = get().ticket;
      const s = get().session;
      const a = account();
      if (!t || !s || !a || !feed || s.endedAt || a.status !== 'active') return;
      const live = feed.price;
      // a market buy pays the ask
      const fill = entryPrice(t.side, live, spreadOf(get().settings));
      const orderPrice = t.type === 'market' ? fill : t.entry;
      const lotsN = ticketLots(t, a.balance, orderPrice);
      const maxLots = availableGoldLots(a, s, orderPrice);
      if (lotsN > maxLots) {
        get().showToast(`Lot fazla: bu bakiye ve ${leverageFor(a.rules, inst)}× kaldıraçla en çok ${maxLots.toFixed(2)} lot açabilirsin.`, 'warn');
        return;
      }
      if (!Number.isFinite(lotsN) || lotsN < MIN_LOT) {
        get().showToast('Risk bütçesi 0,01 lot için yetersiz.', 'warn');
        return;
      }
      if (t.type === 'market') {
        const long = t.side === 'long';
        const quote = markPrice(t.side, live, spreadOf(get().settings));
        // a level the price has already crossed would fire at once: drop it and say so
        const sl = t.sl !== undefined && (long ? t.sl < quote : t.sl > quote) ? t.sl : undefined;
        const tp = t.tp !== undefined && (long ? t.tp > quote : t.tp < quote) ? t.tp : undefined;
        if (t.sl !== undefined && sl === undefined) get().showToast('SL fiyatın öbür tarafında kaldığı için konmadı.', 'warn');
        if (t.tp !== undefined && tp === undefined) get().showToast('TP fiyatın öbür tarafında kaldığı için konmadı.', 'warn');
        openPos(t.side, lotsN, fill, sl, tp, 'market', feed.current.t);
        if (checkAtQuote(a, s)) { void get().endSession('violation'); return; }
        runShots();
      } else {
        const type = deriveType(t.side, t.entry, feed.price);
        const o: Order = { id: uid(), side: t.side, type, price: t.entry, sl: t.sl, tp: t.tp, lots: lotsN, createdAt: feed.clock };
        s.orders.push(o);
        play('place');
      }
      set({ ticket: null, session: { ...s }, live: computeLive() });
      persistSession(s, true);
      marketBus.emit('update');
    },

    cancelTicket() {
      set({ ticket: null });
    },

    selectLine(t) {
      set({ editing: t, ticket: t ? null : get().ticket });
    },

    setOrderLots(id, lots) {
      const s = get().session;
      const o = s?.orders.find((x) => x.id === id);
      if (!s || !o) return;
      const allowed = availableGoldLots(account()!, s, o.price, o.id);
      const nextLots = Math.min(roundLots(lots), allowed);
      if (nextLots < MIN_LOT) { get().showToast(`Bu emir için ${leverageFor(account()!.rules, inst)}× kaldıraçta kullanılabilir bakiye yok.`, 'warn'); return; }
      o.lots = nextLots;
      set({ session: { ...s } });
      persistSession(s);
    },

    cancelOrder(id) {
      if (get().editing?.id === id) set({ editing: null });
      const s = get().session;
      if (!s) return;
      s.orders = s.orders.filter((o) => o.id !== id);
      play('cancel');
      set({ session: { ...s } });
      persistSession(s, true);
    },

    closePosition(id) {
      if (get().editing?.id === id) set({ editing: null });
      const s = get().session;
      const p = s?.positions.find((x) => x.id === id);
      const a = account();
      if (!s || !a || !p || !feed || s.endedAt || a.status !== 'active') return;
      if (checkAtQuote(a, s)) { void get().endSession('violation'); return; }
      closePos(p, markPrice(p.side, feed.price, spreadOf(get().settings)), 'manual', feed.clock);
      play('cancel');
      saveAccount(a);
      if (checkAtQuote(a, s)) { void get().endSession('violation'); return; }
      set({ session: { ...s }, live: computeLive() });
      runShots();
      persistSession(s, true);
      // a manual close can complete the step
      tryPass();
    },

    moveLine(target, price) {
      const s = get().session;
      if (!s || !feed) return;
      const cur = feed.price;
      if (target.kind === 'ticket') {
        const t = get().ticket;
        if (!t) return;
        const next = { ...t };
        if (target.field === 'entry') {
          const d = price - t.entry;
          next.entry = price;
          if (t.sl !== undefined) next.sl = t.sl + d;
          if (t.tp !== undefined) next.tp = t.tp + d;
          next.type = deriveType(t.side, price, cur, spreadOf(get().settings));
        } else if (target.field === 'sl') {
          next.sl = t.side === 'long' ? Math.min(price, t.entry - 0.01) : Math.max(price, t.entry + 0.01);
        } else {
          next.tp = t.side === 'long' ? Math.max(price, t.entry + 0.01) : Math.min(price, t.entry - 0.01);
        }
        set({ ticket: next });
        return;
      }
      if (target.kind === 'order') {
        const o = s.orders.find((x) => x.id === target.id);
        if (!o) return;
        if (target.field === 'entry') {
          const d = price - o.price;
          o.price = price;
          if (o.sl !== undefined) o.sl += d;
          if (o.tp !== undefined) o.tp += d;
          o.type = deriveType(o.side, price, cur, spreadOf(get().settings));
        } else if (target.field === 'sl') o.sl = o.side === 'long' ? Math.min(price, o.price - 0.01) : Math.max(price, o.price + 0.01);
        else o.tp = o.side === 'long' ? Math.max(price, o.price + 0.01) : Math.min(price, o.price - 0.01);
      } else {
        const p = s.positions.find((x) => x.id === target.id);
        if (!p) return;
        // A stop may trail past entry but stays beyond the executable quote.
        const quote = markPrice(p.side, cur, spreadOf(get().settings));
        if (target.field === 'sl') p.sl = p.side === 'long' ? Math.min(price, quote - 0.01) : Math.max(price, quote + 0.01);
        else if (target.field === 'tp') p.tp = p.side === 'long' ? Math.max(price, quote + 0.01) : Math.min(price, quote - 0.01);
        if (!p.riskLocked && p.sl !== undefined) p.initialSl = p.sl;
      }
      set({ session: { ...s } });
    },

    clearLevel(target) {
      if (target.field === 'entry') return;
      const f = target.field;
      if (target.kind === 'ticket') {
        const t = get().ticket;
        if (!t) return;
        lastTicket = { ...lastTicket, [f === 'sl' ? 'withSl' : 'withTp']: false };
        set({ ticket: { ...t, [f]: undefined } });
        return;
      }
      const s = get().session;
      if (!s) return;
      const h = target.kind === 'pos' ? s.positions.find((x) => x.id === target.id) : s.orders.find((x) => x.id === target.id);
      if (!h) return;
      h[f] = undefined;
      if ('levels' in h && h.levels && feed) h.levels.push({ at: feed.clock, sl: h.sl, tp: h.tp });
      set({ session: { ...s } });
      persistSession(s, true);
      play('cancel');
    },

    placeLevel(target) {
      if (target.field === 'entry' || !feed) return;
      const f = target.field;
      const d = defaultDistance();
      const s = get().session;
      let side: Side;
      let entry: number;
      if (target.kind === 'ticket') {
        const t = get().ticket;
        if (!t) return;
        side = t.side;
        entry = t.type === 'market' ? feed.price : t.entry;
      } else {
        const h = target.kind === 'pos' ? s?.positions.find((x) => x.id === target.id) : s?.orders.find((x) => x.id === target.id);
        if (!h) return;
        side = h.side;
        // a live position measures from wherever is further from the market, so the level never fires at once
        entry = 'entry' in h ? (f === 'sl' ? (side === 'long' ? Math.min(h.entry, feed.price) : Math.max(h.entry, feed.price)) : side === 'long' ? Math.max(h.entry, feed.price) : Math.min(h.entry, feed.price)) : h.price;
      }
      const price = f === 'sl' ? entry - dir(side) * d : entry + dir(side) * d * 2;
      get().moveLine(target, price);
    },

    commitLine() {
      const s = get().session;
      s?.positions.forEach((p) => {
        const last = p.levels?.at(-1);
        if (feed && last && (last.sl !== p.sl || last.tp !== p.tp)) p.levels!.push({ at: feed.clock, sl: p.sl, tp: p.tp });
        if (p.sl !== undefined && !p.riskLocked) {
          p.initialSl = p.sl;
          p.riskLocked = true;
        }
      });
      persistSession(s, true);
      play('place');
    },

    addDrawing(d) {
      const s = get().session;
      if (!s) return;
      s.drawings = [...s.drawings, d];
      set({ session: { ...s } });
      persistSession(s);
    },
    updateDrawing(d) {
      const s = get().session;
      if (!s) return;
      s.drawings = s.drawings.map((x) => (x.id === d.id ? d : x));
      set({ session: { ...s } });
      persistSession(s);
    },
    removeDrawing(id) {
      const s = get().session;
      if (!s) return;
      s.drawings = s.drawings.filter((x) => x.id !== id);
      set({ session: { ...s } });
      persistSession(s);
    },
    clearDrawings() {
      const s = get().session;
      if (!s) return;
      s.drawings = [];
      set({ session: { ...s } });
      persistSession(s);
    },

    async archiveAccount(id, archived) {
      const a = get().accounts.find((x) => x.id === id);
      if (!a) return;
      if (archived && get().session?.accountId === id) await get().endSession('user');
      const next = { ...a, archived };
      await db.putAccount(next);
      set({ accounts: get().accounts.map((x) => (x.id === id ? next : x)) });
    },

    async requestPayout(accountId) {
      const a = get().accounts.find((x) => x.id === accountId);
      if (!a || a.phase !== 'funded' || a.status !== 'active') return;
      const s = get().session;
      if (s && s.accountId === accountId && s.positions.length) {
        get().showToast('Ödeme için açık pozisyon olmamalı.', 'warn');
        return;
      }
      const lim = accountLimits(a, null);
      const why = payoutBlocker(a, 0);
      if (why) {
        get().showToast(why, 'warn');
        return;
      }
      const gross = a.balance - a.size - lim.buffer;
      const amount = payoutNet(gross, splitFor(a.rules, a.payouts.length), a.rules.payoutFeePct ?? 0);
      a.payouts = [...a.payouts, { id: uid(), accountId: a.id, gross, amount, at: Date.now() }];
      a.balance = a.size + lim.buffer;
      a.payoutDays = [];
      if (s && s.accountId === a.id) {
        s.dayStartEquity = a.balance;
        persistSession(s, true);
      }
      await db.putAccount(a);
      set({ accounts: get().accounts.map((x) => (x.id === a.id ? { ...a } : x)), overlay: { kind: 'payout', account: { ...a }, amount, gross } });
      if (s && s.accountId === a.id) set({ live: computeLive() });
      play('payout');
    },

    dismissOverlay() {
      set({ overlay: null });
    },

    dismissNotice(id) {
      set({ notices: get().notices.filter((n) => n.id !== id) });
    },

    toggleTicketLevel(field) {
      const t = get().ticket;
      if (!t || !feed) return;
      const entry = t.type === 'market' ? feed.price : t.entry;
      const next = { ...t };
      if (next[field] !== undefined) next[field] = undefined;
      else {
        const d = defaultDistance();
        next[field] = field === 'sl' ? entry - dir(t.side) * d : entry + dir(t.side) * d * 2;
      }
      lastTicket = { ...lastTicket, withSl: next.sl !== undefined, withTp: next.tp !== undefined };
      set({ ticket: next });
    },

    async saveNote(tradeId, note) {
      const t = get().trades.find((x) => x.id === tradeId);
      if (!t) return;
      t.note = note;
      await db.putTrade(t);
      set({ trades: [...get().trades] });
    },

    async saveSettings(p) {
      const settings = { ...get().settings, ...p };
      configureSound({ enabled: settings.sound, volume: settings.volume, barTick: settings.barTick });
      set({ settings });
      await db.putKv('settings', settings);
    },

    openReplay(tradeId) {
      get().setPlaying(false);
      set({ replayTradeId: tradeId, view: 'replay' });
    },
    openJournal(tradeId) {
      set({ journalTradeId: tradeId, view: 'journal' });
    },

    showToast(text, tone = 'neutral') {
      const id = Date.now();
      set({ toast: { id, text, tone } });
      setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, 3600);
    },
  };
});


if (import.meta.env.DEV) (window as unknown as { __s2c: typeof useApp }).__s2c = useApp;
