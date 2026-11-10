/**
 * Historical release dates from BLS archive URLs; 08:30 New York time.
 * FOMC statements use the Federal Reserve meeting calendar (14:00 New York).
 * Coverage is finite: missing dates are not inferred.
 */

const FOMC: string[] = [
  '2021-01-27', '2021-03-17', '2021-04-28', '2021-06-16', '2021-07-28', '2021-09-22', '2021-11-03', '2021-12-15',
  '2022-01-26', '2022-03-16', '2022-05-04', '2022-06-15', '2022-07-27', '2022-09-21', '2022-11-02', '2022-12-14',
  '2023-02-01', '2023-03-22', '2023-05-03', '2023-06-14', '2023-07-26', '2023-09-20', '2023-11-01', '2023-12-13',
  '2024-01-31', '2024-03-20', '2024-05-01', '2024-06-12', '2024-07-31', '2024-09-18', '2024-11-07', '2024-12-18',
  '2025-01-29', '2025-03-19', '2025-05-07', '2025-06-18', '2025-07-30', '2025-09-17', '2025-10-29', '2025-12-10',
  '2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17', '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09',
];

// https://www.bls.gov/bls/news-release/empsit.htm and /cpi.htm (archive publication dates).
const NFP = `2023-01-06 2023-02-03 2023-03-10 2023-04-07 2023-05-05 2023-06-02 2023-07-07 2023-08-04 2023-09-01 2023-10-06 2023-11-03 2023-12-08
2024-01-05 2024-02-02 2024-03-08 2024-04-05 2024-05-03 2024-06-07 2024-07-05 2024-08-02 2024-09-06 2024-10-04 2024-11-01 2024-12-06
2025-01-10 2025-02-07 2025-03-07 2025-04-04 2025-05-02 2025-06-06 2025-07-03 2025-08-01 2025-09-05 2025-11-20 2025-12-16
2026-01-09 2026-02-11 2026-03-06 2026-04-03 2026-05-08 2026-06-05 2026-07-02 2026-08-07 2026-09-04 2026-10-02 2026-11-06`.split(/\s+/);
const CPI = `2023-01-12 2023-02-14 2023-03-14 2023-04-12 2023-05-10 2023-06-13 2023-07-12 2023-08-10 2023-09-13 2023-10-12 2023-11-14 2023-12-12
2024-01-11 2024-02-13 2024-03-12 2024-04-10 2024-05-15 2024-06-12 2024-07-11 2024-08-14 2024-09-11 2024-10-10 2024-11-13 2024-12-11
2025-01-15 2025-02-12 2025-03-12 2025-04-10 2025-05-13 2025-06-11 2025-07-15 2025-08-12 2025-09-11 2025-10-24 2025-12-18
2026-01-13 2026-02-13 2026-03-11 2026-04-10 2026-05-12 2026-06-10 2026-07-14 2026-08-12 2026-09-11 2026-10-14`.split(/\s+/);

function nthSunday(year: number, month: number, n: number) {
  const d = new Date(Date.UTC(year, month, 1));
  const first = (7 - d.getUTCDay()) % 7;
  return Date.UTC(year, month, 1 + first + (n - 1) * 7);
}

/** US daylight time: 2nd Sunday of March → 1st Sunday of November. */
function usDst(ms: number) {
  const y = new Date(ms).getUTCFullYear();
  return ms >= nthSunday(y, 2, 2) + 7 * 3_600_000 && ms < nthSunday(y, 10, 1) + 6 * 3_600_000;
}

/** New York wall time on a UTC date → UTC ms. */
function nyTime(y: number, m: number, d: number, hh: number, mm: number) {
  const guess = Date.UTC(y, m, d, hh + 5, mm);
  return usDst(guess) ? guess - 3_600_000 : guess;
}

export interface EconEvent {
  t: number;
  label: string;
}

export function eventsBetween(from: number, to: number): EconEvent[] {
  const out: EconEvent[] = [];
  for (const [label, dates] of [['NFP', NFP], ['CPI', CPI]] as const) for (const s of dates) {
    const [y, m, d] = s.split('-').map(Number);
    out.push({ t: nyTime(y, m - 1, d, 8, 30), label });
  }
  for (const s of FOMC) {
    const [y, m, d] = s.split('-').map(Number);
    out.push({ t: nyTime(y, m - 1, d, 14, 0), label: 'FOMC' });
  }
  return out.filter((e) => e.t >= from && e.t <= to).sort((x, y) => x.t - y.t);
}

const londonHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23' });
const nyHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' });

/** Session bands: London 08–16 and New York 08–17 in their local time zones. */
export function marketSession(ms: number): { name: string; key: 'asia' | 'london' | 'overlap' | 'ny' } {
  const london = Number(londonHour.format(ms));
  const ny = Number(nyHour.format(ms));
  const l = london >= 8 && london < 16;
  const n = ny >= 8 && ny < 17;
  if (l && n) return { name: 'Londra + New York', key: 'overlap' };
  if (l) return { name: 'Londra', key: 'london' };
  if (n) return { name: 'New York', key: 'ny' };
  return { name: 'Asya', key: 'asia' };
}
