/** Hex mirrors of the CSS tokens, for canvas (chart) drawing. Keep in sync with styles/tokens.css. */
export const C = {
  ply0: '#1a1816',
  ply1: '#201e1b',
  ply2: '#292622',
  rule: '#37332e',
  grid: '#24211e',
  ink1: '#ece7dd',
  ink2: '#a9a397',
  ink3: '#938c80',
  gold: '#d9b25c',
  goldStrong: '#e8c46e',
  up: '#43c29e',
  down: '#ec7363',
  warn: '#f0a24b',
  label: '#ede6d3',
};

/** Indicator series palette: distinct from candles and from each other on the dark ground. */
/** Drawn from the world: label ivory, amber, desaturated teal and coral, warm neutrals. No gold: gold certifies. */
export const SERIES = ['#e6dfcf', '#f0a24b', '#6fb5a2', '#d98c80', '#c2a878', '#8ea3a8', '#b48fa0', '#a9a397'];

export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
