/** Experimental score fitted on 116 historical Gold trades; see scripts/train-1m-filter.mjs. */
export const TRAINED_1M_THRESHOLD = 0.45;

export function trained1mScore(source: string, strong: boolean, side: 'long' | 'short', signalTime: number): number {
  const angle = (2 * Math.PI * new Date(signalTime).getUTCHours()) / 24;
  const value = -0.1558025029215127
    - 0.16627418554568044 * Number(source.includes('5dk'))
    + 0.016048123097841413 * Number(source.includes('15dk'))
    + 0.028524126963648627 * Number(source.includes('1sa'))
    - 0.030844968121027036 * Number(strong)
    + 0.03341620055117184 * Number(side === 'long')
    - 0.036451000936688065 * Math.sin(angle)
    + 0.04955226357098959 * Math.cos(angle);
  return 1 / (1 + Math.exp(-value));
}
