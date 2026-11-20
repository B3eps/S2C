/**
 * Parça Gold probability model: the chance that a Gold engulf signal reaches 1R before its stop.
 *
 * Logistic regression, fitted by scripts/fit-gold-model.mjs on real 5-minute XAU/USD candles of
 * the TRAIN periods only (2024 – early 2025), then checked on later TEST periods (2025 – 2026)
 * that played no part in the fit. Every input is measured on candles closed at the signal.
 * Refit with that script; do not edit the numbers by hand.
 */
export const GOLD_MODEL = {"feats":["adx","vol","slope21","ext21","rsi","engulfLog","riskAtr","room","m15","htf"],"mu":[28.77603,1.29264,0.45865,1.67892,64.17223,0.53288,3.19419,1.15439,0.87742,0.49032],"sd":[7.34747,0.39748,0.4949,1.00168,8.5348,1.03129,1.23408,1.40913,0.32796,0.49991],"w":[-0.04546,0.62412,0.02307,0.10077,0.24658,-0.14478,-0.25545,0.20423,0.05299,-0.24789],"b":0.19932} as const;

export interface SignalFeatures {
  /** ADX(14) of the chart */
  adx: number;
  /** ATR(14) / its average over 288 candles */
  vol: number;
  /** EMA21 change over 5 candles in the trade direction, in ATR */
  slope21: number;
  /** distance of the close beyond EMA21 in the trade direction, in ATR */
  ext21: number;
  /** RSI(14) seen from the trade side (100 − RSI for a short) */
  rsi: number;
  /** engulf body / previous body */
  engulfRatio: number;
  /** distance to the stop, in ATR */
  riskAtr: number;
  /** room to the nearest opposing swing of the last 48 candles, in risk units (9 when none) */
  room: number;
  /** last closed 15-minute candle beyond its EMA50 in the trade direction */
  m15: boolean;
  /** the engulfed zone comes from 15m or a higher timeframe */
  htf: boolean;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function winProbability(f: SignalFeatures): number {
  const x = [
    f.adx,
    Math.min(f.vol, 2.5),
    clamp(f.slope21, -1, 1.5),
    clamp(f.ext21, -1, 4),
    f.rsi,
    Math.log(clamp(f.engulfRatio, 0.2, 10)),
    Math.min(6, f.riskAtr),
    Math.min(3, f.room),
    f.m15 ? 1 : 0,
    f.htf ? 1 : 0,
  ];
  let s: number = GOLD_MODEL.b;
  for (let j = 0; j < x.length; j++) s += GOLD_MODEL.w[j] * (x[j] - GOLD_MODEL.mu[j]) / GOLD_MODEL.sd[j];
  return 1 / (1 + Math.exp(-s));
}
