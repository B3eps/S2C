import { useMemo, useState } from 'react';
import type { Trade } from '../lib/types';
import { signedMoney } from '../lib/format';
import { useApp } from '../store';

const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Group by actual completion date, not the hidden historical replay date. */
export function PerformanceCalendar({ trades }: { trades: Trade[] }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const byDay = useMemo(() => {
    const result = new Map<string, { pnl: number; count: number; wins: number }>();
    for (const trade of trades) {
      const key = keyOf(new Date(trade.realClosedAt));
      const value = result.get(key) ?? { pnl: 0, count: 0, wins: 0 };
      value.pnl += trade.pnl; value.count++; if (trade.pnl > 0) value.wins++;
      result.set(key, value);
    }
    return result;
  }, [trades]);
  const year = month.getFullYear(), m = month.getMonth();
  const first = (new Date(year, m, 1).getDay() + 6) % 7;
  const days = new Date(year, m + 1, 0).getDate();
  const rows = Math.ceil((first + days) / 7);
  const monthly = trades.filter((t) => { const d = new Date(t.realClosedAt); return d.getFullYear() === year && d.getMonth() === m; });
  const net = monthly.reduce((sum, t) => sum + t.pnl, 0);
  const changeMonth = (n: number) => { setMonth(new Date(year, m + n, 1)); setSelectedDay(null); };
  const selected = selectedDay === null ? [] : monthly.filter((t) => new Date(t.realClosedAt).getDate() === selectedDay);
  return (
    <section className="panel performance-calendar">
      <div className="calendar-heading">
        <div><h2>İşlem takvimi</h2><p>İşlemlerin tamamlandığı günlere göre</p></div>
        <div className="calendar-controls">
          <button className="btn sm" onClick={() => changeMonth(-1)} aria-label="Önceki ay">‹</button>
          <strong>{new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(month)}</strong>
          <button className="btn sm" onClick={() => changeMonth(1)} aria-label="Sonraki ay">›</button>
          <button className="btn sm" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelectedDay(null); }}>Bu ay</button>
        </div>
        <div className="calendar-total"><span>Ayın sonucu</span><strong className={net > 0 ? 'up' : net < 0 ? 'down' : ''}>{monthly.length ? signedMoney(net) : '—'}</strong><small>{monthly.length} işlem</small></div>
      </div>
      <div className="calendar-grid" aria-label="Aylık işlem takvimi">
        {dayNames.map((d) => <div className="calendar-day-label" key={d}>{d}</div>)}
        <div className="calendar-day-label">Hafta</div>
        {Array.from({ length: rows }, (_, row) => {
          const cells = Array.from({ length: 7 }, (_, col) => {
            const day = row * 7 + col - first + 1;
            if (day < 1 || day > days) return <div className="calendar-cell outside" key={col} aria-hidden="true" />;
            const value = byDay.get(keyOf(new Date(year, m, day)));
            const cls = `calendar-cell ${value ? value.pnl > 0 ? 'positive' : value.pnl < 0 ? 'negative' : 'neutral' : ''} ${selectedDay === day ? 'selected' : ''}`;
            if (!value) return <div key={col} className={cls}><span className="calendar-date">{day}</span></div>;
            return <button type="button" key={col} className={cls} onClick={() => setSelectedDay(selectedDay === day ? null : day)} aria-pressed={selectedDay === day} aria-label={`${day} ${new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(month)}: ${value.count} işlem, ${signedMoney(value.pnl)}`}>
              <span className="calendar-date">{day}</span><span className="calendar-values"><strong>{signedMoney(value.pnl)}</strong><small>{value.count} işlem</small><small>%{Math.round(value.wins / value.count * 100)} kazanma</small></span>
            </button>;
          });
          const weekTrades = monthly.filter((t) => Math.floor((new Date(t.realClosedAt).getDate() - 1 + first) / 7) === row);
          const weekNet = weekTrades.reduce((sum, t) => sum + t.pnl, 0);
          return [...cells, <div key="week" className="calendar-week"><span>{row + 1}. hafta</span><strong className={weekNet > 0 ? 'up' : weekNet < 0 ? 'down' : ''}>{weekTrades.length ? signedMoney(weekNet) : '—'}</strong><small>{weekTrades.length} işlem</small></div>];
        })}
      </div>
      {selectedDay !== null && <div className="calendar-selection"><div><strong>{selectedDay} {new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(month)}</strong><span>{selected.length} tamamlanan işlem</span></div><div className="calendar-trades">{selected.map((t) => <button key={t.id} className="btn sm" onClick={() => useApp.getState().openJournal(t.id)}>{t.side === 'long' ? 'Long' : 'Short'} · {signedMoney(t.pnl)} · Günlükte aç</button>)}</div></div>}
    </section>
  );
}
