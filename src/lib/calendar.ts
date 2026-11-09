/**
 * Economic events shown as markers. NFP is derived from its release rule (first Friday,
 * 08:30 New York time); FOMC statements use the published meeting calendar (14:00 New York).
 * Rare rule exceptions to the NFP date are not modelled.
 */

const FOMC: string[] = [
  '2021-01-27', '2021-03-17', '2021-04-28', '2021-06-16', '2021-07-28', '2021-09-22', '2021-11-03', '2021-12-15',
  '2022-01-26', '2022-03-16', '2022-05-04', '2022-06-15', '2022-07-27', '2022-09-21', '2022-11-02', '2022-12-14',
  '2023-02-01', '2023-03-22', '2023-05-03', '2023-06-14', '2023-07-26', '2023-09-20', '2023-11-01', '2023-12-13',
  '2024-01-31', '2024-03-20', '2024-05-01', '2024-06-12', '2024-07-31', '2024-09-18', '2024-11-07', '2024-12-18',
  '2025-01-29', '2025-03-19', '2025-05-07', '2025-06-18', '2025-07-30', '2025-09-17', '2025-10-29', '2025-12-10',
  '2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17', '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09',
];

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
  const a = new Date(from);
  const b = new Date(to);
  for (let y = a.getUTCFullYear(), m = a.getUTCMonth(); y < b.getUTCFullYear() || (y === b.getUTCFullYear() && m <= b.getUTCMonth()); ) {
    const first = new Date(Date.UTC(y, m, 1)).getUTCDay();
    const fri = 1 + ((5 - first + 7) % 7);
    out.push({ t: nyTime(y, m, fri, 8, 30), label: 'NFP' });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  for (const s of FOMC) {
    const [y, m, d] = s.split('-').map(Number);
    out.push({ t: nyTime(y, m - 1, d, 14, 0), label: 'FOMC' });
  }
  return out.filter((e) => e.t >= from && e.t <= to).sort((x, y) => x.t - y.t);
}

/** Trading session for a UTC time (approximate, without DST shifts). */
export function marketSession(ms: number): { name: string; key: 'asia' | 'london' | 'overlap' | 'ny' } {
  const h = new Date(ms).getUTCHours();
  if (h >= 12 && h < 16) return { name: 'Londra + New York', key: 'overlap' };
  if (h >= 7 && h < 12) return { name: 'Londra', key: 'london' };
  if (h >= 16 && h < 21) return { name: 'New York', key: 'ny' };
  return { name: 'Asya', key: 'asia' };
}
