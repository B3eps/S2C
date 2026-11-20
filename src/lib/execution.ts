import { CONTRACT, MIN_LOT } from './types';
import type { Bar, Order, Position, Side } from './types';

/**
 * Candles are bid prices. A long buys at the ask and sells at the bid; a short sells at the bid
 * and buys back at the ask. `spread` is ask − bid in dollars; 0 reproduces a single price series.
 */
export const DEFAULT_SPREAD = 0.2;

/** Price a market order on this side fills at. */
export const entryPrice = (side: Side, bid: number, spread = 0) => (side === 'long' ? bid + spread : bid);
/** Price an open position on this side is valued and closed at. */
export const markPrice = (side: Side, bid: number, spread = 0) => (side === 'short' ? bid + spread : bid);

/** One-minute OHLC cannot reveal the order of the high and low. */
export function pendingFill(order: Order, bar: Bar, spread = 0): number | undefined {
  if (order.side === 'long') {
    // buys trade on the ask
    if (order.type === 'limit' && bar.l + spread <= order.price) return Math.min(bar.o + spread, order.price);
    if (order.type === 'stop' && bar.h + spread >= order.price) return Math.max(bar.o + spread, order.price);
  } else {
    if (order.type === 'limit' && bar.h >= order.price) return Math.max(bar.o, order.price);
    if (order.type === 'stop' && bar.l <= order.price) return Math.min(bar.o, order.price);
  }
  return undefined;
}

/** Stops take priority when both levels are touched. For an intrabar entry, a touched
 * stop is conservatively applied; a target is deferred because it may precede entry.
 * An entry at the open is known to precede both extremes. */
export function positionExit(position: Position, bar: Bar, entryOnBar: boolean, filledAtOpen: boolean, spread = 0): { price: number; reason: 'sl' | 'tp' } | undefined {
  const long = position.side === 'long';
  // a long exits on the bid, a short on the ask
  const shift = long ? 0 : spread;
  const o = bar.o + shift, h = bar.h + shift, l = bar.l + shift;
  const slHit = position.sl !== undefined && (long ? l <= position.sl : h >= position.sl);
  const tpHit = position.tp !== undefined && (long ? h >= position.tp : l <= position.tp);
  if (slHit) return { price: entryOnBar && !filledAtOpen ? position.sl! : long ? Math.min(o, position.sl!) : Math.max(o, position.sl!), reason: 'sl' };
  if (tpHit && (!entryOnBar || filledAtOpen)) return { price: long ? Math.max(o, position.tp!) : Math.min(o, position.tp!), reason: 'tp' };
  return undefined;
}

export function riskLots(budget: number, distance: number) {
  if (!(budget > 0 && distance > 0)) return 0;
  return Math.floor(budget / (distance * CONTRACT * MIN_LOT) + 1e-10) * MIN_LOT;
}

export function worstEquity(balance: number, positions: Position[], bar: Bar, spread = 0) {
  const equityAt = (bid: number) => positions.reduce((sum, p) =>
    sum + (markPrice(p.side, bid, spread) - p.entry) * p.lots * CONTRACT * (p.side === 'long' ? 1 : -1), balance);
  return Math.min(equityAt(bar.l), equityAt(bar.h));
}

export const tradePnl = (p: Pick<Position, 'side' | 'entry' | 'lots'>, exit: number, commissionPct: number) =>
  ((exit - p.entry) * (p.side === 'long' ? 1 : -1) - (p.entry + exit) * commissionPct / 100) * p.lots * CONTRACT;

export const equityAt = (balance: number, positions: readonly Position[], bid: number, spread: number, commissionPct: number) =>
  positions.reduce((sum, p) => sum + ((markPrice(p.side, bid, spread) - p.entry) *
    (p.side === 'long' ? 1 : -1) - p.entry * commissionPct / 100) * p.lots * CONTRACT, balance);

export type CandlePath = 'high-first' | 'low-first';
export type CandleEvent =
  | { kind: 'fill'; order: Order; price: number }
  | { kind: 'cancel'; order: Order; allowed: number }
  | { kind: 'exit'; id: string; price: number; reason: 'sl' | 'tp' | 'violation' };

export interface CandleBook {
  balance: number;
  peak: number;
  positions: readonly Position[];
  orders: readonly Order[];
  spread: number;
  commissionPct: number;
  leverage: number;
  dayFloor: number;
  maxFloor: (peak: number) => number;
}

export const maxLotsFor = (equity: number, price: number, leverage: number) =>
  equity > 0 && price > 0 ? Math.floor(equity * leverage / (price * CONTRACT * MIN_LOT) + 1e-9) * MIN_LOT : 0;

export function availableLots(balance: number, leverage: number, positions: readonly Position[], orders: readonly Order[], price: number, excluding?: string) {
  const used = positions.reduce((sum, p) => sum + p.lots * p.entry * CONTRACT, 0) +
    orders.reduce((sum, o) => sum + (o.id === excluding ? 0 : o.lots * o.price * CONTRACT), 0);
  return maxLotsFor(balance - used / leverage, price, leverage);
}

const EPS = 1e-8;

/** Resolve crossings on one monotone-segment OHLC path. The open is a discontinuity. */
export function simulateCandle(book: CandleBook, bar: Bar, path: CandlePath) {
  const { spread, commissionPct, leverage, dayFloor, maxFloor } = book;
  let { balance, peak } = book;
  const positions = new Map(book.positions.map(p => [p.id, p]));
  const orders = new Map(book.orders.map(o => [o.id, o]));
  const events: CandleEvent[] = [];
  let worst = Infinity;
  let bid = bar.o;
  let breach: { floor: 'day' | 'max'; equity: number; limit: number; bid: number; crossing: boolean } | undefined;
  const equity = (price: number) => equityAt(balance, [...positions.values()], price, spread, commissionPct);
  const close = (p: Position, reason: 'sl' | 'tp' | 'violation') => {
    const price = markPrice(p.side, bid, spread);
    positions.delete(p.id);
    balance += tradePnl(p, price, commissionPct);
    peak = Math.max(peak, balance);
    events.push({ kind: 'exit', id: p.id, price, reason });
  };
  const limits = () => {
    const total = maxFloor(peak);
    return dayFloor >= total ? { floor: 'day' as const, limit: dayFloor } : { floor: 'max' as const, limit: total };
  };
  const fail = (value: number, crossing = false) => {
    breach = { ...limits(), equity: value, bid, crossing };
    for (const p of positions.values()) close(p, 'violation');
    worst = Math.min(worst, balance);
  };
  const check = () => {
    const value = equity(bid);
    worst = Math.min(worst, value);
    if (value < limits().limit - EPS) fail(value);
    return !!breach;
  };
  const orderBid = (o: Order) => o.price - (o.side === 'long' ? spread : 0);
  const exitBid = (p: Position, level: number) => level - (p.side === 'short' ? spread : 0);
  const settle = () => {
    if (check()) return;
    // At shared prices, protective stops and targets release exposure before new entry.
    // Account limits are checked before and after each executable event.
    for (;;) {
      const exits = [...positions.values()];
      const stop = exits.find(p => p.sl !== undefined && (p.side === 'long' ? bid <= exitBid(p, p.sl) + EPS : bid >= exitBid(p, p.sl) - EPS));
      const target = exits.find(p => p.tp !== undefined && (p.side === 'long' ? bid >= exitBid(p, p.tp) - EPS : bid <= exitBid(p, p.tp) + EPS));
      if (stop || target) {
        close((stop ?? target)!, stop ? 'sl' : 'tp');
      } else {
        const order = [...orders.values()].find(o => (o.side === 'long') === (o.type === 'stop') ? bid >= orderBid(o) - EPS : bid <= orderBid(o) + EPS);
        if (!order) return;
        const price = entryPrice(order.side, bid, spread);
        const allowed = availableLots(balance, leverage, [...positions.values()], [...orders.values()], price, order.id);
        orders.delete(order.id);
        if (order.lots > allowed + EPS) events.push({ kind: 'cancel', order, allowed });
        else {
          positions.set(order.id, { ...order, entry: price, openedAt: bar.t, orderType: order.type });
          events.push({ kind: 'fill', order, price });
        }
      }
      if (check()) return;
    }
  };
  settle();
  const extremes = path === 'high-first' ? [bar.h, bar.l] : [bar.l, bar.h];
  for (const end of [...extremes, bar.c]) {
    while (!breach && end !== bid) {
      const rising = end > bid;
      let next = end;
      const consider = (level: number) => {
        if (rising ? level > bid + EPS && level < next : level < bid - EPS && level > next) next = level;
      };
      for (const p of positions.values()) {
        const level = rising === (p.side === 'long') ? p.tp : p.sl;
        if (level !== undefined) consider(exitBid(p, level));
      }
      for (const o of orders.values()) if (rising === ((o.side === 'long') === (o.type === 'stop'))) consider(orderBid(o));
      const nextEquity = equity(next);
      const { limit } = limits();
      if (nextEquity < limit - EPS) {
        const startEquity = equity(bid);
        bid += (next - bid) * Math.max(0, startEquity - limit) / (startEquity - nextEquity);
        worst = Math.min(worst, limit);
        fail(limit, true);
      } else {
        bid = next;
        settle();
      }
    }
  }
  return { events, breach, worst, closeEquity: breach ? balance : equity(bar.c), path };
}

/** Select a coherent adverse path rather than combining incompatible highs and lows. */
export function conservativeCandle(book: CandleBook, bar: Bar) {
  const low = simulateCandle(book, bar, 'low-first');
  const high = simulateCandle(book, bar, 'high-first');
  if (!!low.breach !== !!high.breach) return low.breach ? low : high;
  if (Math.abs(low.closeEquity - high.closeEquity) > EPS) return low.closeEquity < high.closeEquity ? low : high;
  return low.worst <= high.worst ? low : high;
}
