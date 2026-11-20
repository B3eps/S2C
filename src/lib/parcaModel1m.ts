/**
 * Experimental score fitted on 116 historical Gold trades by scripts/train-1m-corrected.mjs
 * (analysis/train-1m-corrected-report.md). Weights copied from train-1m-corrected-model.json;
 * refit with that script, never by hand.
 *
 * Source buckets match the training exactly: a source starting with "5dk ", "15dk " or "1sa ".
 * The first version tested `includes('5dk')`, which is also true for "15dk", so every 15-minute
 * signal carried the 5-minute weight too.
 */
export const TRAINED_1M_THRESHOLD = 0.45;

const W = {
  intercept: -0.176778319471753,
  source5m: -0.17170884970460867,
  source15m: -0.016328386141056965,
  source1h: 0.03235933486145932,
  strong: -0.031192619927000106,
  long: 0.032225689381212376,
  hourSin: -0.03875246151826995,
  hourCos: 0.05340318611212735,
};

export function trained1mScore(source: string, strong: boolean, side: 'long' | 'short', signalTime: number): number {
  const angle = (2 * Math.PI * new Date(signalTime).getUTCHours()) / 24;
  const value = W.intercept
    + W.source5m * Number(source.startsWith('5dk '))
    + W.source15m * Number(source.startsWith('15dk '))
    + W.source1h * Number(source.startsWith('1sa '))
    + W.strong * Number(strong)
    + W.long * Number(side === 'long')
    + W.hourSin * Math.sin(angle)
    + W.hourCos * Math.cos(angle);
  return 1 / (1 + Math.exp(-value));
}
