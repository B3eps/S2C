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
