import { useEffect, useRef, useState } from 'react';
import type { Account, SessionRec, Trade } from '../lib/types';
import { accountLimits, countedDays, passBlocker } from '../store';
import { money, money0, pct, plainPct, sizeLabel } from '../lib/format';
import { heatGrid, HeatMetric, WEEKDAYS } from '../lib/stats';
import { C } from '../lib/theme';

/** Animated number: eases from the previous value to the new one. */
export function CountUp({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = shown;
    from.current = a;
    cancelAnimationFrame(raf.current);
    const dur = 420;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - k, 4);
      setShown(a + (value - a) * e);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span className={className}>{format(shown)}</span>;
}

export function Gauge({ name, value, ratio, kind, sub }: { name: string; value: string; ratio: number; kind: 'risk' | 'goal'; sub?: string }) {
  const r = Math.max(0, Math.min(1, ratio));
  const cls = kind === 'risk' ? (r >= 0.8 ? 'crit' : r >= 0.5 ? 'hot' : '') : r >= 1 ? 'done' : '';
  return (
    <div className={`gauge ${kind} ${cls}`} title={sub}>
      <div className="gauge-top">
        <span className="name">{name}</span>
        <span className="val">{value}</span>
      </div>
      <div className="gauge-track">
        <div className="gauge-fill" style={{ width: `${r * 100}%` }} />
      </div>
    </div>
  );
}

/** The three rule gauges for an account (live equity when a session is running). */
export function RuleGauges({ a, s, equity }: { a: Account; s: SessionRec | null; equity: number }) {
  const lim = accountLimits(a, s);
  const dayStart = s?.dayStartEquity ?? a.balance;
  const dayRoom = dayStart - lim.dayFloor;
  const dayUsed = Math.max(0, dayStart - equity);
  const maxRoom = a.size - lim.maxFloor;
  const maxUsed = Math.max(0, a.size - equity);
  const days = countedDays(a);
  const blocker = passBlocker(a, s?.positions.length ?? 0);
  const stepName = lim.steps > 1 ? `Aşama ${lim.step + 1} hedefi` : 'Hedef';
  const goal =
    a.phase === 'challenge'
      ? { name: stepName, ratio: (a.balance - a.size) / (lim.target - a.size), value: blocker ?? `${pct(((a.balance - a.size) / a.size) * 100, 2)} / %${String(lim.targetPct).replace('.', ',')}` }
      : { name: 'Ödeme eşiği', ratio: (a.balance - a.size) / (lim.payoutAt - a.size), value: `${pct(((a.balance - a.size) / a.size) * 100, 2)} / %${a.rules.payoutMin}` };
  return (
    <>
      <Gauge name="Günlük zarar" kind="risk" ratio={dayUsed / dayRoom} value={`${money0(dayUsed)} / ${money0(dayRoom)}`} />
      <Gauge name="Toplam zarar" kind="risk" ratio={maxUsed / maxRoom} value={`${money0(maxUsed)} / ${money0(maxRoom)}`} />
      <Gauge
        name={goal.name}
        kind="goal"
        ratio={goal.ratio}
        value={goal.value}
        sub={a.phase === 'challenge' ? `${a.rules.minDayPct ? 'Kârlı gün' : 'İşlem günü'}: ${days} / ${a.rules.minDays}` : undefined}
      />
    </>
  );
}

/** Certificate label: the account as an issued, graded slab label. */
export function CertLabel({ a, compact, className = '', stampAnim }: { a: Account; compact?: boolean; className?: string; stampAnim?: boolean }) {
  const growth = ((a.balance - a.size) / a.size) * 100;
  const voidAcc = a.status === 'violated';
  const funded = a.phase === 'funded' && !voidAcc;
  const days = countedDays(a);
  const paid = a.payouts.reduce((s, p) => s + p.amount, 0);
  const lim = accountLimits(a, null);
  const phaseText = a.phase === 'funded' ? 'Fonlu' : lim.steps > 1 ? `Aşama ${lim.step + 1}/${lim.steps}` : 'Değerlendirme';
  return (
    <div
      className={`cert ${funded ? 'funded' : ''} ${voidAcc ? 'void' : ''} ${compact ? 'compact' : ''} ${className}`}
      onPointerMove={
        funded
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const kx = (e.clientX - r.left) / r.width;
              const ky = (e.clientY - r.top) / r.height;
              e.currentTarget.style.setProperty('--holo-x', `${kx * 100}%`);
              e.currentTarget.style.setProperty('--holo-px', `${kx * 100}%`);
              e.currentTarget.style.setProperty('--holo-tilt', `${50 + ky * 40}deg`);
            }
          : undefined
      }
    >
      <div className="cert-main">
        {compact ? (
          <>
            <span className="cert-top">XAUUSD · {sizeLabel(a.size)}</span>
            <span className="cert-no">{a.no}</span>
          </>
        ) : (
          <>
            <div className="cert-top">
              <span>XAUUSD</span>
              <span className="sep" />
              <span>{sizeLabel(a.size)}</span>
              {a.programName && (
                <>
                  <span className="sep" />
                  <span>{a.programName}</span>
                </>
              )}
              <span className="sep" />
              <span>{phaseText}</span>
            </div>
            <div className="cert-no">{a.no}</div>
            <div className="cert-meta">
              <span>
                Bakiye <b>{money(a.balance)}</b>
              </span>
              {a.phase === 'challenge' ? (
                <span>
                  {a.rules.minDayPct ? 'Kârlı gün' : 'İşlem günü'} <b>{days}</b> / {a.rules.minDays}
                </span>
              ) : (
                <span>
                  Çekilen <b>{money0(paid)}</b>
                </span>
              )}
            </div>
          </>
        )}
      </div>
      <div className="cert-grade">
        {voidAcc ? (
          <>
            <span className="g-label">Durum</span>
            <span className="g-value">{pct(growth, 1)}</span>
          </>
        ) : funded ? (
          <>
            <span className="g-label">Sınıf</span>
            <span className="g-value">FONLU</span>
            {!compact && <span className="g-sub">{pct(growth, 2)}</span>}
          </>
        ) : (
          <>
            <span className="g-label">İlerleme</span>
            <span className="g-value" style={{ color: growth < 0 ? '#b23a2a' : undefined }}>
              {pct(growth, compact ? 1 : 2)}
            </span>
            {!compact && <span className="g-sub">hedef %{String(lim.targetPct).replace('.', ',')}</span>}
          </>
        )}
      </div>
      {funded && <div className="holo" />}
      {voidAcc && <span className={`stamp ${stampAnim ? 'stamp-in' : ''}`}>İHLAL</span>}
    </div>
  );
}

/** Cumulative P&L curve with zero line and drawdown shading. */
export function EquityCurve({ points, height = 200 }: { points: { i: number; v: number }[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  if (points.length < 2) return <div className="empty">Henüz kapanmış işlem yok.</div>;
  const pad = { l: 8, r: 8, t: 12, b: 18 };
  const vs = points.map((p) => p.v);
  const lo = Math.min(0, ...vs);
  const hi = Math.max(0, ...vs);
  const span = hi - lo || 1;
  const X = (i: number) => pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (v - lo) / span) * (height - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join('');
  // drawdown = region below the running peak and above the curve
  let peak = -Infinity;
  const peakPts: string[] = [];
  points.forEach((p, i) => {
    if (i) peakPts.push(`L${X(i).toFixed(1)} ${Y(peak).toFixed(1)}`);
    peak = Math.max(peak, p.v);
    peakPts.push(`${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(peak).toFixed(1)}`);
  });
  const bottom = height - pad.b;
  const belowPeak = peakPts.join('') + `L${X(points.length - 1)} ${bottom}L${X(0)} ${bottom}Z`;
  const aboveCurve = d + `L${X(points.length - 1)} ${pad.t}L${X(0)} ${pad.t}Z`;
  const last = points[points.length - 1].v;
  const col = last >= 0 ? C.up : C.down;
  const hp = hover !== null ? points[hover] : null;
  return (
    <div
      ref={ref}
      className="curve"
      style={{ position: 'relative' }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const k = (e.clientX - r.left - pad.l) / (w - pad.l - pad.r);
        setHover(Math.max(0, Math.min(points.length - 1, Math.round(k * (points.length - 1)))));
      }}
      onMouseLeave={() => setHover(null)}
    >
      <svg height={height} viewBox={`0 0 ${w} ${height}`}>
        <line x1={pad.l} x2={w - pad.r} y1={Y(0)} y2={Y(0)} stroke={C.rule} strokeDasharray="3 3" />
        <clipPath id="dd-clip">
          <path d={aboveCurve} />
        </clipPath>
        <path d={belowPeak} fill="rgba(236,115,99,0.12)" clipPath="url(#dd-clip)" />
        <path d={d} fill="none" stroke={col} strokeWidth={1.75} strokeLinejoin="round" />
        {hp && (
          <>
            <line x1={X(hover!)} x2={X(hover!)} y1={pad.t} y2={height - pad.b} stroke={C.ink3} strokeDasharray="2 3" />
            <circle cx={X(hover!)} cy={Y(hp.v)} r={3.5} fill={C.ply0} stroke={col} strokeWidth={1.5} />
          </>
        )}
        <text x={pad.l} y={height - 4} fill={C.ink3} fontSize={11}>
          0
        </text>
        {[hi, 0, lo]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((v) => (
            <text key={v} x={w - pad.r} y={Y(v) - 4} fill={C.ink3} fontSize={11} textAnchor="end">
              {money(v)}
            </text>
          ))}
        <text x={w - pad.r} y={height - 4} fill={C.ink3} fontSize={11} textAnchor="end">
          {points.length - 1}
        </text>
      </svg>
      {hp && (
        <div className="tip" style={{ position: 'absolute', left: Math.min(X(hover!) + 10, w - 140), top: 0 }}>
          İşlem {hp.i}: <b className={hp.v >= 0 ? 'up' : 'down'}>{money(hp.v)}</b>
        </div>
      )}
    </div>
  );
}

/** One magnitude ramp for every heat cell; diverging around zero for R. */
function heatColor(v: number | undefined, metric: HeatMetric, max: number) {
  if (v === undefined) return undefined;
  if (metric === 'r') {
    const k = Math.min(1, Math.abs(v) / (max || 1));
    return v >= 0 ? `rgba(67,194,158,${0.25 + k * 0.7})` : `rgba(236,115,99,${0.25 + k * 0.7})`;
  }
  if (metric === 'winrate') {
    const k = v / 100;
    return k >= 0.5 ? `rgba(67,194,158,${0.25 + (k - 0.5) * 1.4})` : `rgba(236,115,99,${0.25 + (0.5 - k) * 1.4})`;
  }
  return `rgba(236,231,221,${0.2 + Math.min(1, v / (max || 1)) * 0.7})`;
}

/** One magnitude ramp: the cell's filled square grows with |value|, the same ramp as its tint. */
function magnitude(v: number | undefined, metric: HeatMetric, max: number) {
  if (v === undefined) return 0;
  const k = metric === 'winrate' ? Math.abs(v - 50) / 50 : Math.min(1, Math.abs(v) / (max || 1));
  return (0.35 + 0.65 * k).toFixed(3);
}

export function Heatmap({ trades }: { trades: Trade[] }) {
  const [metric, setMetric] = useState<HeatMetric>('r');
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const grid = heatGrid(trades, metric);
  const max = Math.max(0, ...grid.flat().map((c) => Math.abs(c.value ?? 0)));
  return (
    <div>
      <div className="seg" style={{ marginBottom: 12 }} role="group" aria-label="Ölçüt">
        {(
          [
            ['r', 'Toplam R'],
            ['winrate', 'Kazanma oranı'],
            ['count', 'İşlem sayısı'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} aria-pressed={metric === k} onClick={() => setMetric(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="heat">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="collab">
            {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
          </span>
        ))}
        {grid.map((row, d) => (
          <Row key={d} label={WEEKDAYS[d]}>
            {row.map((c, h) => (
              <span
                key={h}
                className="cell"
                data-v={c.value !== undefined ? '' : undefined}
                style={{ ['--m' as string]: magnitude(c.value, metric, max) }}
                onMouseEnter={(e) =>
                  c.value !== undefined &&
                  setTip({
                    x: e.clientX,
                    y: e.clientY,
                    text: `${WEEKDAYS[d]} ${String(h).padStart(2, '0')}:00 UTC · ${c.n} işlem · ${
                      metric === 'r' ? (c.value >= 0 ? '+' : '') + c.value.toFixed(2).replace('.', ',') + 'R' : metric === 'winrate' ? plainPct(c.value, 0) : c.value
                    }`,
                  })
                }
                onMouseLeave={() => setTip(null)}
              >
                {c.value !== undefined && <i style={{ background: heatColor(c.value, metric, max) }} />}
              </span>
            ))}
          </Row>
        ))}
      </div>
      <div className="heat-legend">
        <span>{metric === 'count' ? 'Az' : 'Zayıf'}</span>
        <span
          className="ramp"
          style={{
            background:
              metric === 'count' ? 'linear-gradient(90deg, rgba(236,231,221,.2), rgba(236,231,221,.9))' : 'linear-gradient(90deg, rgba(236,115,99,.95), rgba(236,115,99,.25) 45%, rgba(67,194,158,.25) 55%, rgba(67,194,158,.95))',
          }}
        />
        <span>{metric === 'count' ? 'Çok' : 'Güçlü'}</span>
        <span style={{ marginLeft: 'auto' }}>Saatler UTC, giriş anına göre</span>
      </div>
      {tip && (
        <div className="tip" style={{ left: tip.x + 12, top: tip.y + 12 }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="rowlab">{label}</span>
      {children}
    </>
  );
}
