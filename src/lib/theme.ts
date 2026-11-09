/** Hex mirrors of the CSS tokens, for canvas (chart) drawing. Keep in sync with styles/tokens.css. */
export const C = {
  ply0: '#121110',
  ply1: '#181715',
  ply2: '#201e1b',
  rule: '#2e2b27',
  grid: '#1c1b18',
  ink1: '#ece7dd',
  ink2: '#a9a397',
  ink3: '#858075',
  gold: '#d9b25c',
  goldStrong: '#e8c46e',
  up: '#43c29e',
  down: '#ec7363',
  warn: '#f0a24b',
  label: '#ede6d3',
};

/** Indicator series palette: distinct from candles and from each other on the dark ground. */
export const SERIES = ['#d9b25c', '#7fa7f0', '#c58bf0', '#5fd0d6', '#f08bb4', '#b9d36a', '#f0a24b', '#e6e1d6'];

export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
