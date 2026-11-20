import type { Rules } from './types';

/**
 * Tradable instruments. Candles are Dukascopy bid prices for the same id (checked Nov 2026:
 * every id below returns 1-minute candles). Contract sizes follow common CFD specs, so P&L per
 * lot matches what a prop platform shows: 1 lot = 100 oz gold, 1 BTC, 1 ETH, $1 per index point.
 */
export type InstrumentId = 'xauusd' | 'btcusd' | 'ethusd' | 'usa500idxusd' | 'usatechidxusd';
export type AssetClass = 'metal' | 'crypto' | 'index';

export interface Instrument {
  id: InstrumentId;
  /** ticker shown on the chart */
  symbol: string;
  /** Turkish name for menus */
  name: string;
  cls: AssetClass;
  /** units per 1.00 lot */
  contract: number;
  minLot: number;
  /** default ask − bid in price units */
  spread: number;
  /** distance used for a fresh ticket's stop when the chart gives no hint, in price units */
  stopHint: number;
}

export const INSTRUMENTS: Instrument[] = [
  { id: 'xauusd', symbol: 'XAUUSD', name: 'Altın', cls: 'metal', contract: 100, minLot: 0.01, spread: 0.2, stopHint: 3 },
  { id: 'btcusd', symbol: 'BTCUSD', name: 'Bitcoin', cls: 'crypto', contract: 1, minLot: 0.01, spread: 20, stopHint: 300 },
  { id: 'ethusd', symbol: 'ETHUSD', name: 'Ethereum', cls: 'crypto', contract: 1, minLot: 0.01, spread: 1.5, stopHint: 15 },
  { id: 'usa500idxusd', symbol: 'US500', name: 'S&P 500', cls: 'index', contract: 1, minLot: 0.01, spread: 0.5, stopHint: 10 },
  { id: 'usatechidxusd', symbol: 'US100', name: 'Nasdaq 100', cls: 'index', contract: 1, minLot: 0.01, spread: 1.5, stopHint: 40 },
];

export const INSTRUMENT_BY_ID = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i])) as Record<InstrumentId, Instrument>;
export const isInstrumentId = (v: unknown): v is InstrumentId => typeof v === 'string' && v in INSTRUMENT_BY_ID;
/** Records made before instruments existed are gold. */
export const instrumentOf = (r: { instrument?: string } | null | undefined): Instrument =>
  INSTRUMENT_BY_ID[(r?.instrument as InstrumentId) ?? 'xauusd'] ?? INSTRUMENT_BY_ID.xauusd;

/** Default leverage when a program publishes none for the class. */
const LEVERAGE: Record<AssetClass, number> = { metal: 15, crypto: 2, index: 20 };
export const leverageFor = (r: Rules, i: Instrument) =>
  i.cls === 'metal' ? r.goldLeverage ?? LEVERAGE.metal : i.cls === 'crypto' ? r.cryptoLeverage ?? LEVERAGE.crypto : r.indexLeverage ?? LEVERAGE.index;
export const commissionFor = (r: Rules, i: Instrument) =>
  (i.cls === 'crypto' ? r.cryptoCommissionPct : undefined) ?? r.commissionPct ?? 0;

/** Market hours: crypto trades every minute; gold and the US indices follow the CME week. */
export const tradesAllWeek = (i: Instrument) => i.cls === 'crypto';
