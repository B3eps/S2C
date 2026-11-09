const usd = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 2 });
const usd0 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export const money = (v: number) => usd.format(v);
export const money0 = (v: number) => usd0.format(v);
export const signedMoney = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + usd.format(Math.abs(v));
export const pct = (v: number, d = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + '%' + Math.abs(v).toFixed(d).replace('.', ',');
export const plainPct = (v: number, d = 1) => '%' + v.toFixed(d).replace('.', ',');
export const rMult = (v: number | undefined) =>
  v === undefined || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2).replace('.', ',') + 'R';
export const lots = (v: number) => num2.format(v);
export const n2 = (v: number) => num2.format(v);
export const sizeLabel = (size: number) => (size >= 1000 ? `${size / 1000}K` : String(size));

const dtf = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long', timeZone: 'UTC' });
const tf = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
const shortDt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const shortD = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
export const longDate = (ms: number) => dtf.format(ms);
export const clockUtc = (ms: number) => tf.format(ms);
export const wallDateTime = (ms: number) => shortDt.format(ms);
export const wallDate = (ms: number) => shortD.format(ms);
export const goldPrice = (p: number) => num2.format(p);

export const dayKeyUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
