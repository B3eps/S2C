import { CONTRACT, MIN_LOT } from './types';
import type { Bar, Order, Position } from './types';

/** One-minute OHLC cannot reveal the order of the high and low. */
export function pendingFill(order: Order, bar: Bar): number | undefined {
  if (order.side === 'long') {
    if (order.type === 'limit' && bar.l <= order.price) return Math.min(bar.o, order.price);
    if (order.type === 'stop' && bar.h >= order.price) return Math.max(bar.o, order.price);
  } else {
    if (order.type === 'limit' && bar.h >= order.price) return Math.max(bar.o, order.price);
    if (order.type === 'stop' && bar.l <= order.price) return Math.min(bar.o, order.price);
  }
  return undefined;
}

/** Stops take priority when both levels are touched. For an intrabar entry, a touched
 * stop is conservatively applied; a target is deferred because it may precede entry.
 * An entry at the open is known to precede both extremes. */
export function positionExit(position: Position, bar: Bar, entryOnBar: boolean, filledAtOpen: boolean): { price: number; reason: 'sl' | 'tp' } | undefined {
  const long = position.side === 'long';
  const slHit = position.sl !== undefined && (long ? bar.l <= position.sl : bar.h >= position.sl);
  const tpHit = position.tp !== undefined && (long ? bar.h >= position.tp : bar.l <= position.tp);
  if (slHit) return { price: entryOnBar && !filledAtOpen ? position.sl! : long ? Math.min(bar.o, position.sl!) : Math.max(bar.o, position.sl!), reason: 'sl' };
  if (tpHit && (!entryOnBar || filledAtOpen)) return { price: long ? Math.max(bar.o, position.tp!) : Math.min(bar.o, position.tp!), reason: 'tp' };
  return undefined;
}

export function riskLots(budget: number, distance: number) {
  if (!(budget > 0 && distance > 0)) return 0;
  return Math.floor(budget / (distance * CONTRACT * MIN_LOT) + 1e-10) * MIN_LOT;
}

export function worstEquity(balance: number, positions: Position[], bar: Bar) {
  const equityAt = (price: number) => positions.reduce((sum, p) =>
    sum + (price - p.entry) * p.lots * CONTRACT * (p.side === 'long' ? 1 : -1), balance);
  return Math.min(equityAt(bar.l), equityAt(bar.h));
}
