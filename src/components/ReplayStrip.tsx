import { useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { eventsBetween, marketSession } from '../lib/calendar';
import { isClosed } from '../lib/market';
import { instrumentOf, tradesAllWeek } from '../lib/instruments';
import { clockUtc } from '../lib/format';

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SNAP = 15 * MIN;

type Band = { a: number; b: number; key: string };

/**
 * The prop day (22:00 → 22:00 UTC) as a scrubber. What has been revealed is filled, what lies
 * ahead is hatched. Clicking ahead plays every minute up to that point through the order and
 * rule engine; there is no way back, so nothing from the future can be seen and undone.
 */
export function ReplayStrip() {
  const session = useApp((s) => s.session);
  const clock = useApp((s) => s.live.clock);
  const trades = useApp((s) => s.sessionTrades);
  const busy = useApp((s) => s.playing || s.seekingSignal || s.dataWait);
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const dayKey = session?.dayKey ?? '';
  const start = dayKey ? Date.parse(`${dayKey}T00:00:00Z`) - 2 * HOUR : 0;
  const end = start + DAY;
  const inst = instrumentOf(session);

  const bands = useMemo(() => {
    const out: Band[] = [];
    if (!start) return out;
    for (let t = start; t < end; t += SNAP) {
      const key = !tradesAllWeek(inst) && isClosed(t) ? 'closed' : marketSession(t).key;
      const last = out[out.length - 1];
      if (last && last.key === key) last.b = t + SNAP;
      else out.push({ a: t, b: t + SNAP, key });
    }
    return out;
  }, [start, end, inst]);
  const events = useMemo(() => (start ? eventsBetween(start, end) : []), [start, end]);

  if (!session || !start) return null;
  const pos = (t: number) => Math.max(0, Math.min(1, (t - start) / DAY));
  const pct = (t: number) => `${pos(t) * 100}%`;
  const p = pos(clock);
  const S = useApp.getState;

  const timeAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const t = start + ((clientX - r.left) / r.width) * DAY;
    return Math.max(start, Math.min(end, Math.round(t / MIN) * MIN));
  };
  const go = (t: number) => {
    if (busy || t <= clock) return;
    void S().advanceTo(t);
  };
  const marks = [
    ...trades.filter((t) => t.openedAt >= start && t.openedAt < end).map((t) => ({ id: `o${t.id}`, t: t.openedAt, side: t.side })),
    ...session.positions.filter((x) => x.openedAt >= start).map((x) => ({ id: `p${x.id}`, t: x.openedAt, side: x.side })),
  ];
  const ahead = hover !== null && hover > clock;

  return (
    <div
      ref={ref}
      className={`strip ${busy ? 'busy' : ''} ${hover !== null && !ahead ? 'past-hover' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label="Prop günü şeridi"
      aria-valuemin={start}
      aria-valuemax={end}
      aria-valuenow={clock}
      aria-valuetext={`${clockUtc(clock)} UTC`}
      onPointerMove={(e) => setHover(timeAt(e.clientX))}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => go(timeAt(e.clientX))}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(Math.ceil((clock + 1) / SNAP) * SNAP); }
        if (e.key === 'End') { e.preventDefault(); go(end); }
      }}
    >
      {bands.map((b) => (
        <span key={b.a} className={`strip-band ${b.key}`} style={{ left: pct(b.a), width: `${((b.b - b.a) / DAY) * 100}%` }} />
      ))}
      {[3, 6, 9, 12, 15, 18, 21].map((h) => (
        <span key={h} className="strip-tick" style={{ left: `${(h / 24) * 100}%` }} />
      ))}
      <span className="strip-past" style={{ transform: `scaleX(${p})` }} />
      <span className="strip-future" style={{ left: `${p * 100}%` }} />
      {marks.map((m) => (
        <span key={m.id} className={`strip-trade ${m.side}`} style={{ left: pct(m.t) }} />
      ))}
      {events.map((ev) => (
        <button
          key={`${ev.label}${ev.t}`}
          className={`strip-event ${ev.t <= clock ? 'done' : ''}`}
          style={{ left: pct(ev.t) }}
          title={ev.t > clock ? `${ev.label} · ${clockUtc(ev.t)} UTC. Tıkla: bir dakika öncesine ilerle.` : `${ev.label} · ${clockUtc(ev.t)} UTC`}
          onClick={(e) => {
            e.stopPropagation();
            go(ev.t - MIN);
          }}
        >
          <i />
          <span>{ev.label}</span>
        </button>
      ))}
      <span className="strip-head" style={{ transform: `translateX(${p * 100}%)` }}>
        <i />
      </span>
      {hover !== null && (
        <span className={`strip-ghost ${pos(hover) > 0.8 ? 'flip' : ''} ${ahead ? '' : 'past'}`} style={{ transform: `translateX(${pos(hover) * 100}%)` }}>
          <i />
          <b>{ahead ? `${clockUtc(hover)} · ilerle` : clockUtc(hover)}</b>
        </span>
      )}
    </div>
  );
}
