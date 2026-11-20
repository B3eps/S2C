import type { SetupParams } from './parcaSetup';

export const PARCA_CLASSIC_ID = 'parca-setup';
export const PARCA_GOLD_ID = 'parca-setup-gold';
export const PARCA_GOLD_A_ID = 'parca-setup-gold-a';
export const PARCA_TRAINED_1M_ID = 'parca-trained-1m';
export type ParcaId = typeof PARCA_CLASSIC_ID | typeof PARCA_GOLD_ID | typeof PARCA_GOLD_A_ID | typeof PARCA_TRAINED_1M_ID;
export const isParcaId = (id: string): id is ParcaId => id === PARCA_CLASSIC_ID || id === PARCA_GOLD_ID || id === PARCA_GOLD_A_ID || id === PARCA_TRAINED_1M_ID;
export const isGoldId = (id: string) => id === PARCA_GOLD_ID || id === PARCA_GOLD_A_ID || id === PARCA_TRAINED_1M_ID;
export const parcaName = (id: ParcaId) => id === PARCA_TRAINED_1M_ID ? '1dk Deneysel' : id === PARCA_GOLD_A_ID ? 'Gold A+' : id === PARCA_GOLD_ID ? 'Gold' : 'Klasik';

/**
 * Gold preset: the engulf in the bias direction is the entry, with a 2R target. Chosen on real
 * XAU/USD candles (scripts/backtest-parca.mjs): several signals a day, positive on the periods
 * it was chosen on and on the later periods kept aside. Side by side with the classic preset.
 */
export const GOLD_SETUP_DEFAULTS: SetupParams = {
  pivot: 2,
  window: 10,
  zoneAge: 80,
  minGap: 0.25,
  biasMode: 2,
  sweep: 0,
  session: 1,
  entry: 2,
  rr: 1,
  ema: 1,
  adx: 20,
  vol: 0,
  minP: 0,
  room: 2,
  noOB: 1,
};

/**
 * Gold A+: Gold engulf signals whose modelled chance of reaching 1R is at least 55%
 * (src/lib/parcaModel.ts). On the 5m TEST periods, never seen by the fit, about 3 in 4 such
 * trades reached 1R first, at roughly 2-4 signals a week.
 */
export const GOLD_A_SETUP_DEFAULTS: SetupParams = { ...GOLD_SETUP_DEFAULTS, ema: 0, minP: 0.55 };

/** Gold settings saved before the trend filter existed are an older preset: use the current one. */
export const variantParams = (id: ParcaId, params: Partial<SetupParams>): Partial<SetupParams> => {
  // The model was fitted on the fixed Gold configuration. Do not silently change its inputs.
  if (id === PARCA_TRAINED_1M_ID) return { ...GOLD_SETUP_DEFAULTS, trained1m: 1 };
  if (id === PARCA_GOLD_A_ID) return params.minP === undefined || params.room === undefined ? GOLD_A_SETUP_DEFAULTS : { ...GOLD_A_SETUP_DEFAULTS, ...params };
  if (id !== PARCA_GOLD_ID) return params;
  return params.adx === undefined || params.minP === undefined || params.room === undefined ? GOLD_SETUP_DEFAULTS : { ...GOLD_SETUP_DEFAULTS, ...params };
};
