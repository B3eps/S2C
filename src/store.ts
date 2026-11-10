import { create } from 'zustand';
import { Feed, randomStart } from './lib/feed';
import { store as db } from './lib/db';
import { play, configureSound } from './lib/sound';
import { atr } from './lib/indicators';
import { dayKeyUtc, money0 } from './lib/format';
import { PROGRAMS, salePrice, stepTargets } from './lib/programs';
import type { ActiveInd } from './lib/indicators';
import {
  Account, CONTRACT, CloseReason, DEFAULT_RULES, Drawing, DrawingKind, MIN_LOT, Order, OrderType, Position, Rules,
  SessionRec, Side, TF, TF_MS, Trade, uid,
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
  layout: 'single' | 'dual';
  tfA: TF;
  tfB: TF;
  indA: ActiveInd[];
  indB: ActiveInd[];
  speed: number;
}

export const SPEEDS = [1, 2, 4, 8, 16, 32];

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
  settings: Settings;
  prefs: ChartPrefs;
  session: SessionRec | null;
  loading: { progress: number; error?: string } | null;
  live: Live;
  playing: boolean;
  dataWait: boolean;
  tool: Tool;
  ticket: Ticket | null;
  overlay: Overlay | null;
  notices: Notice[];
  replayTradeId: string | null;
  journalTradeId: string | null;
  sessionTrades: Trade[];
  toast: { id: number; text: string; tone: 'neutral' | 'warn' | 'down' } | null;

  boot(): Promise<void>;
  go(v: View): void;
  createAccount(size: number, programId?: string): Promise<void>;
  archiveAccount(id: string, archived: boolean): Promise<void>;
  startSession(accountId: string): Promise<void>;
  endSession(reason?: Notice['reason']): Promise<void>;
  stepBar(): void;
  stepMinutes(n: number): void;
  setPlaying(p: boolean): void;
  setPrefs(p: Partial<ChartPrefs>): void;
  setTool(t: Tool): void;
  openTicket(side: Side, type?: OrderType, entry?: number): void;
  updateTicket(p: Partial<Ticket>): void;
  submitTicket(): void;
  cancelTicket(): void;
  cancelOrder(id: string): void;
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
export const pnlOf = (side: Side, entry: number, exit: number, lots: number) => (exit - entry) * dir(side) * lots * CONTRACT;
export const riskOf = (entry: number, sl: number | undefined, lots: number) =>
  sl === undefined ? undefined : Math.abs(entry - sl) * lots * CONTRACT;
const roundLots = (x: number) => Math.max(MIN_LOT, Math.floor(x / MIN_LOT + 1e-9) * MIN_LOT);

export function ticketLots(t: Ticket, balance: number, entry = t.entry) {
  if (t.useRisk && t.sl !== undefined && Math.abs(entry - t.sl) > 0) {
    return roundLots((balance * t.riskPct) / 100 / (Math.abs(entry - t.sl) * CONTRACT));
  }
  return roundLots(t.manualLots);
}

/** Pending orders take their type from the side and where the price sits relative to the market. */
export function deriveType(side: Side, entry: number, price: number): 'limit' | 'stop' {
  if (side === 'long') return entry < price ? 'limit' : 'stop';
  return entry > price ? 'limit' : 'stop';
}

export function accountLimits(a: Account, s: SessionRec | null) {
  const size = a.size;
  const targets = stepTargets(a.rules);
  const step = Math.min(a.step ?? 0, targets.length - 1);
  const dayFloor = (s?.dayStartEquity ?? a.balance) - (size * a.rules.dailyLoss) / 100;
  const maxFloor = size * (1 - a.rules.maxLoss / 100);
  const targetPct = targets[step];
  const target = size * (1 + targetPct / 100);
  const minGross = (a.rules.payoutMinUsd ?? 0) / (a.rules.split / 100);
  const payoutAt = Math.max(size * (1 + a.rules.payoutMin / 100), size + minGross, size + 0.01);
  return { dayFloor, maxFloor, target, targetPct, step, steps: targets.length, payoutAt };
}

/** Days that count toward the minimum: profitable days when the program asks for them, else any traded day. */
export function countedDays(a: Account) {
  const pct = a.rules.minDayPct ?? 0;
  if (!pct) return new Set(a.tradingDays).size;
  const need = (a.size * pct) / 100;
  return Object.values(a.dayPnl ?? {}).filter((v) => v >= need).length;
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
  return null;
}

const persistSession = (() => {
  let t: number | undefined;
  return (s: SessionRec | null, now = false) => {
    if (!s) return;
    clearTimeout(t);
    if (now) db.putSession(s);
    else t = window.setTimeout(() => db.putSession(s), 1500);
  };
})();

const accountNo = (existing: Account[]) => {
  const n = existing.reduce((m, a) => Math.max(m, parseInt(a.no.replace(/^S2C-/, ''), 10) || 0), 0);
  return `S2C-${n + 1}`;
};

const DEFAULT_PREFS: ChartPrefs = {
  layout: 'single',
  tfA: '5m',
  tfB: '1h',
  indA: [],
  indB: [],
  speed: 1,
};

let warned = { day: false, max: false };
let lastTicket = { riskPct: 1, manualLots: 0.1, useRisk: true, withSl: true, withTp: true };

/** 1.5 × ATR(14) of the main chart: where a fresh stop is first drawn. */
export function defaultDistance() {
  const f = getFeed();
  if (!f) return 1;
  const bars = f.bars(useApp.getState().prefs.tfA);
  return (atr(bars.slice(-200), 14).at(-1) || f.price * 0.002) * 1.5;
}
let playRaf = 0;

// ── store ─────────────────────────────────────────────────────────────────────
export const useApp = create<State>((set, get) => {
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
            if (p) p.shotOpen = id;
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
    const floating = s.positions.reduce((acc, p) => acc + pnlOf(p.side, p.entry, price, p.lots), 0);
    const equity = a.balance + floating;
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
    const commission = (((p.entry + exit) * p.lots * CONTRACT) * (a.rules.commissionPct ?? 0)) / 100;
    const pnl = pnlOf(p.side, p.entry, exit, p.lots) - commission;
    const risk = riskOf(p.entry, p.initialSl, p.lots);
    const dk = `${s.id}:${dayKeyUtc(at - 60_000)}`;
    a.dayPnl = { ...(a.dayPnl ?? {}), [dk]: (a.dayPnl?.[dk] ?? 0) + pnl };
    const trade: Trade = {
      id: p.id,
      accountId: a.id,
      sessionId: s.id,
      side: p.side,
      lots: p.lots,
      entry: p.entry,
      exit,
      sl: p.sl,
      tp: p.tp,
      initialSl: p.initialSl,
      openedAt: p.openedAt,
      closedAt: at,
      pnl,
      r: risk ? pnl / risk : undefined,
      reason,
      orderType: p.orderType,
      tf: get().prefs.tfA,
      note: get().trades.find((t) => t.id === p.id)?.note ?? '',
      shotOpen: p.shotOpen,
      realClosedAt: Date.now(),
    };
    s.positions = s.positions.filter((x) => x.id !== p.id);
    a.balance += pnl;
    db.putTrade(trade);
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
    const p: Position = { id: uid(), side, lots, entry, sl, tp, initialSl: sl, riskLocked: sl !== undefined, openedAt: at, orderType: type };
    s.positions.push(p);
    const key = `${s.id}:${dayKeyUtc(at)}`;
    if (!a.tradingDays.includes(key)) a.tradingDays.push(key);
    saveAccount(a);
    shotJobs.push({ kind: 'open', posId: p.id });
    play('fill');
    fxBus.emit({ kind: 'fill', price: entry, at });
    return p;
  };

  /** Process one revealed minute: fills, exits, day roll, rules. Returns false when the session ended. */
  const processMinute = (): boolean => {
    if (!feed) return false;
    const s = get().session;
    const a = account();
    if (!s || !a) return false;
    const m = feed.current;
    const at = feed.clock;

    // day roll
    const dk = dayKeyUtc(m.t);
    if (dk !== s.dayKey) {
      const floating = s.positions.reduce((acc, p) => acc + pnlOf(p.side, p.entry, m.o, p.lots), 0);
      s.dayKey = dk;
      s.dayStartEquity = a.balance + floating;
      warned = { day: false, max: false };
    }
    s.high = Math.max(s.high ?? m.h, m.h);
    s.low = Math.min(s.low ?? m.l, m.l);
    s.lastPrice = m.c;

    // pending orders
    for (const o of [...s.orders]) {
      let fill: number | undefined;
      if (o.side === 'long') {
        if (o.type === 'limit' && m.l <= o.price) fill = Math.min(m.o, o.price);
        if (o.type === 'stop' && m.h >= o.price) fill = Math.max(m.o, o.price);
      } else {
        if (o.type === 'limit' && m.h >= o.price) fill = Math.max(m.o, o.price);
        if (o.type === 'stop' && m.l <= o.price) fill = Math.min(m.o, o.price);
      }
      if (fill !== undefined) {
        s.orders = s.orders.filter((x) => x.id !== o.id);
        const p = openPos(o.side, o.lots, fill, o.sl, o.tp, o.type, at);
        p.openedAt = m.t;
      }
    }

    // exits: stop first when both are touched inside one minute (conservative)
    for (const p of [...s.positions]) {
      if (p.openedAt === m.t) continue;
      const long = p.side === 'long';
      const slHit = p.sl !== undefined && (long ? m.l <= p.sl : m.h >= p.sl);
      const tpHit = p.tp !== undefined && (long ? m.h >= p.tp : m.l <= p.tp);
      if (slHit) closePos(p, long ? Math.min(m.o, p.sl!) : Math.max(m.o, p.sl!), 'sl', at);
      else if (tpHit) closePos(p, long ? Math.max(m.o, p.tp!) : Math.min(m.o, p.tp!), 'tp', at);
    }

    // rules on worst intrabar equity
    const worst = a.balance + s.positions.reduce((acc, p) => acc + pnlOf(p.side, p.entry, p.side === 'long' ? m.l : m.h, p.lots), 0);
    const lim = accountLimits(a, s);
    const live = get().live;
    set({ live: { ...live, worstEquity: Math.min(live.worstEquity, worst) } });
    let breach: string | null = null;
    if (worst <= lim.dayFloor) breach = `Günlük zarar limiti aşıldı (%${a.rules.dailyLoss}).`;
    else if (worst <= lim.maxFloor) breach = `Toplam zarar limiti aşıldı (%${a.rules.maxLoss}).`;
    if (breach) {
      for (const p of [...s.positions]) closePos(p, m.c, 'violation', at);
      s.orders = [];
      a.status = 'violated';
      a.violatedAt = Date.now();
      a.violation = breach;
      saveAccount(a);
      play('violation');
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
    s.orders = [];
    const last = lim.step >= lim.steps - 1;
    a.balance = a.size;
    a.tradingDays = [];
    a.dayPnl = {};
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
    persistSession(get().session);
  };

  return {
    ready: false,
    view: 'dashboard',
    accounts: [],
    trades: [],
    sessions: [],
    settings: { rules: DEFAULT_RULES, sound: true, volume: 0.6, barTick: false },
    prefs: DEFAULT_PREFS,
    session: null,
    loading: null,
    live: { price: 0, clock: 0, equity: 0, floating: 0, dayLoss: 0, worstEquity: Infinity },
    playing: false,
    dataWait: false,
    tool: 'cursor',
    ticket: null,
    overlay: null,
    notices: [],
    replayTradeId: null,
    journalTradeId: null,
    sessionTrades: [],
    toast: null,

    async boot() {
      const [accounts, trades, sessions, settings, prefs] = await Promise.all([
        db.accounts(),
        db.trades(),
        db.sessions(),
        db.kv<Settings>('settings'),
        db.kv<ChartPrefs>('prefs'),
      ]);
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
        accounts: accounts.sort((a, b) => b.createdAt - a.createdAt),
        trades,
        sessions,
        settings: st,
        prefs: { ...DEFAULT_PREFS, ...(prefs ?? {}) },
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
      if (view !== 'trade') get().setPlaying(false);
      set({ view });
      try {
        localStorage.setItem('s2c:view', view);
      } catch {
        /* storage unavailable: start on the dashboard next time */
      }
    },

    async createAccount(size, programId) {
      const prog = PROGRAMS.find((p) => p.id === programId);
      const a: Account = {
        id: uid(),
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
        fee: prog ? salePrice(prog.prices[size] ?? 0) : 0,
        dayPnl: {},
      };
      await db.putAccount(a);
      set({ accounts: [a, ...get().accounts] });
      play('place');
      await get().startSession(a.id);
    },

    async startSession(accountId) {
      const a = get().accounts.find((x) => x.id === accountId);
      if (!a || a.status !== 'active') return;
      if (get().session && get().session!.accountId !== accountId) await get().endSession('user');
      let s = get().sessions.find((x) => x.accountId === accountId && !x.endedAt) ?? null;
      const fresh = !s;
      if (!s) {
        const start = randomStart();
        s = {
          id: uid(),
          accountId,
          startMs: start,
          clockMs: start,
          startedAt: Date.now(),
          orders: [],
          positions: [],
          drawings: [],
          dayStartEquity: a.balance,
          dayKey: dayKeyUtc(start),
        };
      }
      set({ view: 'trade', loading: { progress: 0 }, session: null, ticket: null, tool: 'cursor', playing: false });
      try {
        localStorage.setItem('s2c:view', 'trade');
      } catch {
        /* ignore */
      }
      try {
        feed = await Feed.create(s.startMs, s.clockMs, (p) => set({ loading: { progress: p } }));
      } catch {
        set({ loading: { progress: 0, error: 'Piyasa verisi alınamadı. İnternet bağlantını kontrol edip tekrar dene.' } });
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
      marketBus.emit('reset');
    },

    async endSession(reason = 'user') {
      const s = get().session;
      const a = account();
      get().setPlaying(false);
      if (!s || !a || !feed) return;
      if (reason === 'user' || reason === 'data') {
        for (const p of [...s.positions]) closePos(p, feed.price, 'session', feed.clock);
        s.orders = [];
        saveAccount(a);
        if (tryPass()) return;
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
        sessionTrades: [],
        overlay,
        notices: [...get().notices, notice].slice(-3),
      });
      if (get().view === 'trade') get().go('dashboard');
      if (!overlay) play('print');
    },

    stepMinutes(n) {
      if (!feed || !get().session) return;
      let revealed = 0;
      for (let i = 0; i < n; i++) {
        if (!feed.step()) {
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
      const ms = TF_MS[get().prefs.tfA];
      let revealed = 0;
      for (let guard = 0; guard < 2000; guard++) {
        if (!feed.step()) {
          if (feed.exhausted) {
            get().endSession('data');
            return;
          }
          set({ dataWait: true });
          break;
        }
        revealed++;
        if (!processMinute()) return;
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
    },

    setPlaying(p) {
      cancelAnimationFrame(playRaf);
      set({ playing: p });
      if (!p) return;
      let last = performance.now();
      let acc = 0;
      const loop = (now: number) => {
        if (!get().playing) return;
        const dt = Math.min(0.25, (now - last) / 1000);
        last = now;
        acc += dt * SPEEDS[get().prefs.speed];
        let guard = 0;
        while (acc >= 1 && guard++ < 64) {
          acc -= 1;
          get().stepBar();
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
        type: type === 'market' ? 'market' : deriveType(side, e, price),
        entry: e,
        sl: lastTicket.withSl ? e - dir(side) * dist : undefined,
        tp: lastTicket.withTp ? e + dir(side) * dist * 2 : undefined,
        riskPct: lastTicket.riskPct,
        manualLots: lastTicket.manualLots,
        useRisk: lastTicket.useRisk,
      };
      set({ ticket: t });
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
        if (next.type !== 'market' && feed) next.type = deriveType(next.side, next.entry, feed.price);
      }
      set({ ticket: next });
    },

    submitTicket() {
      const t = get().ticket;
      const s = get().session;
      const a = account();
      if (!t || !s || !a || !feed) return;
      const live = feed.price;
      const lotsN = ticketLots(t, a.balance, t.type === 'market' ? live : t.entry);
      if (t.type === 'market') {
        const long = t.side === 'long';
        // a level the price has already crossed would fire at once: drop it and say so
        const sl = t.sl !== undefined && (long ? t.sl < live : t.sl > live) ? t.sl : undefined;
        const tp = t.tp !== undefined && (long ? t.tp > live : t.tp < live) ? t.tp : undefined;
        if (t.sl !== undefined && sl === undefined) get().showToast('SL fiyatın öbür tarafında kaldığı için konmadı.', 'warn');
        if (t.tp !== undefined && tp === undefined) get().showToast('TP fiyatın öbür tarafında kaldığı için konmadı.', 'warn');
        openPos(t.side, lotsN, live, sl, tp, 'market', feed.current.t);
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

    cancelOrder(id) {
      const s = get().session;
      if (!s) return;
      s.orders = s.orders.filter((o) => o.id !== id);
      play('cancel');
      set({ session: { ...s } });
      persistSession(s, true);
    },

    closePosition(id) {
      const s = get().session;
      const p = s?.positions.find((x) => x.id === id);
      if (!s || !p || !feed) return;
      closePos(p, feed.price, 'manual', feed.clock);
      play('cancel');
      saveAccount(account()!);
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
          next.type = deriveType(t.side, price, cur);
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
          o.type = deriveType(o.side, price, cur);
        } else if (target.field === 'sl') o.sl = o.side === 'long' ? Math.min(price, o.price - 0.01) : Math.max(price, o.price + 0.01);
        else o.tp = o.side === 'long' ? Math.max(price, o.price + 0.01) : Math.min(price, o.price - 0.01);
      } else {
        const p = s.positions.find((x) => x.id === target.id);
        if (!p) return;
        // a stop can trail past entry, but never through the current price
        if (target.field === 'sl') p.sl = p.side === 'long' ? Math.min(price, cur - 0.01) : Math.max(price, cur + 0.01);
        else if (target.field === 'tp') p.tp = p.side === 'long' ? Math.max(price, cur + 0.01) : Math.min(price, cur - 0.01);
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
      if (a.balance < lim.payoutAt) {
        get().showToast(`Ödeme için bakiye en az ${money0(lim.payoutAt)} olmalı.`, 'warn');
        return;
      }
      const gross = a.balance - a.size;
      const amount = (gross * a.rules.split) / 100;
      a.payouts = [...a.payouts, { id: uid(), accountId: a.id, gross, amount, at: Date.now() }];
      a.balance = a.size;
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
