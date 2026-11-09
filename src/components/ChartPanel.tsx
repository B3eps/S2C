import { useEffect, useMemo, useRef, useState } from 'react';
import type { SeriesMarker, Time } from 'lightweight-charts';
import { ChartController, LineSpec } from '../lib/chartController';
import { getFeed, marketBus, fxBus, shooter, useApp, ticketLots, pnlOf, riskOf, Fx, LineTarget } from '../store';
import { TF, TFS, TF_LABEL, Drawing, Side, uid } from '../lib/types';
import { IND_BY_ID, ActiveInd } from '../lib/indicators';
import { eventsBetween } from '../lib/calendar';
import { C, SERIES } from '../lib/theme';
import { lots as fmtLots, rMult, signedMoney } from '../lib/format';
import { Icon } from './Icon';
import { IndicatorPicker, ParamPopover } from './IndicatorPicker';

type Target = LineTarget;
type Field = 'sl' | 'tp';
interface OLine {
  key: string;
  price: number;
  cls: string;
  k: string;
  v: string;
  target: Target;
  draggable: boolean;
  onClose?: () => void;
  closeTitle?: string;
  /** levels this entry is missing: shown as SL / TP buttons you can click or drag out */
  missing?: Field[];
  color: string;
  dashed: boolean;
}

const sideWord = (s: Side) => (s === 'long' ? 'Long' : 'Short');
const typeWord = { market: 'Piyasa', limit: 'Limit', stop: 'Stop' } as const;

/**
 * One rule for every owner of lines (draft ticket, pending order, open position):
 *  - the entry tag names the side; its type and size sit in the value, so dragging a pending
 *    order across the price only changes the word Limit/Stop, never the tag's identity;
 *  - every SL and TP tag drags freely and has its own ✕;
 *  - a missing SL or TP shows as a button on the entry tag: click to place it, or drag it out.
 */
function useLines(): OLine[] {
  const session = useApp((s) => s.session);
  const ticket = useApp((s) => s.ticket);
  const live = useApp((s) => s.live);
  const accounts = useApp((s) => s.accounts);
  const account = accounts.find((a) => a.id === session?.accountId);
  const S = useApp.getState;

  return useMemo(() => {
    const out: OLine[] = [];
    if (!session || !account) return out;
    const bal = account.balance;
    const lvl = (side: Side, entry: number, at: number, lots: number, sl?: number) => {
      const pnl = pnlOf(side, entry, at, lots);
      const risk = riskOf(entry, sl, lots);
      return `${risk ? rMult(pnl / risk) + ' · ' : ''}${signedMoney(pnl)}`;
    };
    const missing = (sl?: number, tp?: number): Field[] => [...(sl === undefined ? ['sl' as const] : []), ...(tp === undefined ? ['tp' as const] : [])];
    const levels = (prefix: string, side: Side, entry: number, lots: number, sl: number | undefined, tp: number | undefined, kind: Target['kind'], id: string | undefined, cls: string, riskSl = sl) => {
      if (sl !== undefined)
        out.push({
          key: `${prefix}-sl`,
          price: sl,
          cls: `sl ${cls}`,
          k: 'SL',
          v: lvl(side, entry, sl, lots, riskSl),
          target: { kind, id, field: 'sl' },
          draggable: true,
          color: C.down,
          dashed: kind !== 'pos',
          onClose: () => S().clearLevel({ kind, id, field: 'sl' }),
          closeTitle: 'SL’yi kaldır',
        });
      if (tp !== undefined)
        out.push({
          key: `${prefix}-tp`,
          price: tp,
          cls: `tp ${cls}`,
          k: 'TP',
          v: lvl(side, entry, tp, lots, riskSl),
          target: { kind, id, field: 'tp' },
          draggable: true,
          color: C.up,
          dashed: kind !== 'pos',
          onClose: () => S().clearLevel({ kind, id, field: 'tp' }),
          closeTitle: 'TP’yi kaldır',
        });
    };

    for (const p of session.positions) {
      const floating = pnlOf(p.side, p.entry, live.price, p.lots);
      const risk = riskOf(p.entry, p.initialSl, p.lots);
      out.push({
        key: `p-${p.id}`,
        price: p.entry,
        cls: `entry static ${p.side}`,
        k: `${sideWord(p.side)} ${fmtLots(p.lots)}`,
        v: `${risk ? rMult(floating / risk) + ' · ' : ''}${signedMoney(floating)}`,
        target: { kind: 'pos', id: p.id, field: 'entry' },
        draggable: false,
        onClose: () => S().closePosition(p.id),
        closeTitle: 'Pozisyonu kapat',
        missing: missing(p.sl, p.tp),
        color: p.side === 'long' ? C.up : C.down,
        dashed: false,
      });
      levels(`p-${p.id}`, p.side, p.entry, p.lots, p.sl, p.tp, 'pos', p.id, '', p.initialSl ?? p.sl);
    }
    for (const o of session.orders) {
      out.push({
        key: `o-${o.id}`,
        price: o.price,
        cls: `entry pending ${o.side}`,
        k: sideWord(o.side),
        v: `${typeWord[o.type]} · ${fmtLots(o.lots)} lot`,
        target: { kind: 'order', id: o.id, field: 'entry' },
        draggable: true,
        onClose: () => S().cancelOrder(o.id),
        closeTitle: 'Emri iptal et',
        missing: missing(o.sl, o.tp),
        color: C.ink2,
        dashed: true,
      });
      levels(`o-${o.id}`, o.side, o.price, o.lots, o.sl, o.tp, 'order', o.id, 'pending');
    }
    if (ticket) {
      const entry = ticket.type === 'market' ? live.price : ticket.entry;
      const l = ticketLots(ticket, bal, entry);
      out.push({
        key: 't-entry',
        price: entry,
        cls: `entry ghost ${ticket.side}`,
        k: sideWord(ticket.side),
        v: `${typeWord[ticket.type]} · ${fmtLots(l)} lot`,
        target: { kind: 'ticket', field: 'entry' },
        draggable: true,
        onClose: () => S().cancelTicket(),
        closeTitle: 'Taslağı sil',
        missing: missing(ticket.sl, ticket.tp),
        color: C.gold,
        dashed: true,
      });
      levels('t', ticket.side, entry, l, ticket.sl, ticket.tp, 'ticket', undefined, 'ghost');
    }
    return out;
  }, [session, ticket, live.price, account]);
}

export function ChartPanel({ slot, primary }: { slot: 'a' | 'b'; primary: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<ChartController | null>(null);
  const prefs = useApp((s) => s.prefs);
  const setPrefs = useApp((s) => s.setPrefs);
  const tool = useApp((s) => s.tool);
  const session = useApp((s) => s.session);
  const sessionTrades = useApp((s) => s.sessionTrades);
  const tf: TF = slot === 'a' ? prefs.tfA : prefs.tfB;
  const inds: ActiveInd[] = slot === 'a' ? prefs.indA : prefs.indB;
  const [ver, setVer] = useState(0);
  const [barsLen, setBarsLen] = useState(0);
  const [values, setValues] = useState<Record<string, Record<string, number>>>({});
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<{ uid: string; x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; price: number } | null>(null);
  const [fx, setFx] = useState<(Fx & { id: string; x: number; y: number })[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Drawing | null>(null);
  const lines = useLines();

  // create chart
  useEffect(() => {
    const ctrl = new ChartController(hostRef.current!, tf);
    ctrlRef.current = ctrl;
    let lastVals = 0;
    ctrl.onIndicatorValues = (v) => {
      const now = performance.now();
      if (now - lastVals > 120) {
        lastVals = now;
        setValues(v);
      }
    };
    const f = getFeed();
    if (f) {
      ctrl.reset(f.bars(tf), tf);
      setBarsLen(f.bars(tf).length);
    }
    if (primary) shooter.fn = () => ctrl.screenshot();
    let sig = '';
    let raf = 0;
    const loop = () => {
      const s = ctrl.signature();
      if (s !== sig) {
        sig = s;
        setVer((v) => v + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (primary && shooter.fn) shooter.fn = null;
      ctrl.destroy();
      ctrlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // market data
  useEffect(() => {
    return marketBus.on((kind) => {
      const f = getFeed();
      const ctrl = ctrlRef.current;
      if (!f || !ctrl) return;
      const bars = f.bars(tf);
      if (kind === 'reset') ctrl.reset(bars, tf);
      else ctrl.update(bars);
      setBarsLen(bars.length);
    });
  }, [tf]);

  // timeframe switch
  useEffect(() => {
    const f = getFeed();
    const ctrl = ctrlRef.current;
    if (!f || !ctrl) return;
    ctrl.reset(f.bars(tf), tf);
    setBarsLen(f.bars(tf).length);
  }, [tf]);

  // indicators
  const indKey = JSON.stringify(inds);
  useEffect(() => {
    ctrlRef.current?.setIndicators(inds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indKey]);

  // canvas mirror of order lines (so screenshots carry them)
  useEffect(() => {
    ctrlRef.current?.syncLines(lines.map((l): LineSpec => ({ key: l.key, price: l.price, color: l.color, dashed: l.dashed })));
  }, [lines]);

  // markers: entries, exits, economic events
  useEffect(() => {
    const ctrl = ctrlRef.current;
    const f = getFeed();
    if (!ctrl || !f || !ctrl.bars.length) return;
    const m: SeriesMarker<Time>[] = [];
    const first = ctrl.bars[0].t;
    for (const t of sessionTrades) {
      const mag = Math.min(2, 0.8 + Math.abs(t.r ?? 0) * 0.4);
      m.push({ time: ctrl.bucket(t.openedAt), position: t.side === 'long' ? 'belowBar' : 'aboveBar', shape: t.side === 'long' ? 'arrowUp' : 'arrowDown', color: t.side === 'long' ? C.up : C.down, size: mag });
      m.push({ time: ctrl.bucket(t.closedAt - 60_000), position: 'inBar', shape: 'circle', color: t.reason === 'tp' ? C.gold : t.reason === 'sl' ? C.down : C.ink2, size: mag * 0.7 });
    }
    for (const p of session?.positions ?? []) {
      if (p.openedAt >= first) m.push({ time: ctrl.bucket(p.openedAt), position: p.side === 'long' ? 'belowBar' : 'aboveBar', shape: p.side === 'long' ? 'arrowUp' : 'arrowDown', color: p.side === 'long' ? C.up : C.down, size: 1 });
    }
    for (const e of eventsBetween(first, f.clock)) {
      m.push({ time: ctrl.bucket(e.t), position: 'aboveBar', shape: 'square', color: C.ink3, text: e.label, size: 0.6 });
    }
    ctrl.setMarkers(m.filter((x) => (x.time as number) * 1000 >= first));
  }, [sessionTrades, session?.positions.length, barsLen, tf, session]);

  // fx
  useEffect(() => {
    return fxBus.on((e) => {
      const ctrl = ctrlRef.current;
      if (!ctrl) return;
      if (e.kind === 'bar' && !primary) return;
      requestAnimationFrame(() => {
        const x = ctrl.lastBarX() ?? 0;
        const y = ctrl.priceToY(e.price) ?? 0;
        const id = uid();
        setFx((list) => [...list, { ...e, id, x, y }]);
        setTimeout(() => setFx((list) => list.filter((i) => i.id !== id)), 1000);
      });
    });
  }, [primary]);

  // keyboard: delete selected drawing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && !(e.target as HTMLElement).closest('input,textarea')) {
        useApp.getState().removeDrawing(selected);
        setSelected(null);
      }
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const ctrl = ctrlRef.current;
  const S = useApp.getState;
  const localXY = (e: { clientX: number; clientY: number }) => {
    const r = hostRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toAnchor = (e: { clientX: number; clientY: number }) => {
    const { x, y } = localXY(e);
    const t = ctrl?.xToTime(x);
    const p = ctrl?.yToPrice(y);
    if (t == null || p == null) return null;
    return { t, p };
  };

  // ── line drag ──
  const startDrag = (l: OLine) => (e: React.PointerEvent) => {
    if (!l.draggable || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const p = ctrlRef.current?.yToPrice(localXY(ev).y);
      if (p != null) S().moveLine(l.target, p);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      S().commitLine();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  // ── a missing SL / TP: click to place it, or drag it out of the entry tag ──
  const startDragOut = (l: OLine, field: Field) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const target = { ...l.target, field };
    const y0 = e.clientY;
    let dragged = false;
    const move = (ev: PointerEvent) => {
      if (!dragged && Math.abs(ev.clientY - y0) < 3) return;
      dragged = true;
      const p = ctrlRef.current?.yToPrice(localXY(ev).y);
      if (p != null) S().moveLine(target, p);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      if (!dragged) S().placeLevel(target);
      S().commitLine();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  // ── drawing creation ──
  const onDrawDown = (e: React.PointerEvent) => {
    if (tool === 'cursor' || e.button !== 0) return;
    const a = toAnchor(e);
    if (!a) return;
    if (tool === 'hline') {
      const d: Drawing = { id: uid(), kind: 'hline', a, b: a };
      S().addDrawing(d);
      S().setTool('cursor');
      setSelected(d.id);
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraft({ id: uid(), kind: tool, a, b: a });
  };
  const onDrawMove = (e: React.PointerEvent) => {
    if (!draft) return;
    const b = toAnchor(e);
    if (b) setDraft({ ...draft, b });
  };
  const onDrawUp = () => {
    if (!draft) return;
    const ctrlNow = ctrlRef.current;
    const ax = ctrlNow?.timeToX(draft.a.t) ?? 0;
    const bx = ctrlNow?.timeToX(draft.b.t) ?? 0;
    if (Math.abs(ax - bx) > 3 || Math.abs((ctrlNow?.priceToY(draft.a.p) ?? 0) - (ctrlNow?.priceToY(draft.b.p) ?? 0)) > 3) {
      S().addDrawing(draft);
      setSelected(draft.id);
    }
    setDraft(null);
    S().setTool('cursor');
  };

  const dragHandle = (d: Drawing, which: 'a' | 'b' | 'both') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelected(d.id);
    const el = e.currentTarget as Element;
    el.setPointerCapture(e.pointerId);
    const start = toAnchor(e);
    const move = (ev: PointerEvent) => {
      const p = toAnchor(ev);
      if (!p || !start) return;
      if (which === 'both') {
        const dt = p.t - start.t;
        const dp = p.p - start.p;
        S().updateDrawing({ ...d, a: { t: d.a.t + dt, p: d.a.p + dp }, b: { t: d.b.t + dt, p: d.b.p + dp } });
      } else S().updateDrawing({ ...d, [which]: p });
    };
    const up = () => {
      el.removeEventListener('pointermove', move as EventListener);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move as EventListener);
    el.addEventListener('pointerup', up);
  };

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    const p = ctrl?.yToPrice(localXY(e).y);
    if (p == null) return;
    setMenu({ x: e.clientX, y: e.clientY, price: p });
  };

  const live = useApp((s) => s.live);
  const width = hostRef.current?.clientWidth ?? 0;
  const paneH = ctrl?.mainPaneHeight() ?? 0;
  const drawings = [...(session?.drawings ?? []), ...(draft ? [draft] : [])];
  void ver;

  const renderDrawing = (d: Drawing) => {
    if (!ctrl) return null;
    const ax = ctrl.timeToX(d.a.t);
    const ay = ctrl.priceToY(d.a.p);
    const bx = ctrl.timeToX(d.b.t);
    const by = ctrl.priceToY(d.b.p);
    if (ay == null) return null;
    const sel = selected === d.id;
    if (d.kind === 'hline') {
      return (
        <g key={d.id}>
          <line x1={0} x2={width} y1={ay} y2={ay} className="dhit" onPointerDown={dragHandle(d, 'both')} />
          <line x1={0} x2={width} y1={ay} y2={ay} className={`dline ${sel ? 'sel' : ''}`} style={{ pointerEvents: 'none' }} />
        </g>
      );
    }
    if (ax == null || bx == null || by == null) return null;
    if (d.kind === 'trend') {
      return (
        <g key={d.id}>
          <line x1={ax} y1={ay} x2={bx} y2={by} className="dhit" onPointerDown={dragHandle(d, 'both')} />
          <line x1={ax} y1={ay} x2={bx} y2={by} className={`dline ${sel ? 'sel' : ''}`} style={{ pointerEvents: 'none' }} />
          {sel && (
            <>
              <rect x={ax - 4} y={ay - 4} width={8} height={8} className="dhandle" onPointerDown={dragHandle(d, 'a')} />
              <rect x={bx - 4} y={by - 4} width={8} height={8} className="dhandle" onPointerDown={dragHandle(d, 'b')} />
            </>
          )}
        </g>
      );
    }
    const x = Math.min(ax, bx);
    const y = Math.min(ay, by);
    return (
      <g key={d.id}>
        <rect x={x} y={y} width={Math.abs(bx - ax)} height={Math.abs(by - ay)} className={`drect ${sel ? 'sel' : ''}`} onPointerDown={dragHandle(d, 'both')} />
        {sel && (
          <>
            <rect x={ax - 4} y={ay - 4} width={8} height={8} className="dhandle" onPointerDown={dragHandle(d, 'a')} />
            <rect x={bx - 4} y={by - 4} width={8} height={8} className="dhandle" onPointerDown={dragHandle(d, 'b')} />
          </>
        )}
      </g>
    );
  };

  const setTf = (t: TF) => setPrefs(slot === 'a' ? { tfA: t } : { tfB: t });
  const setInds = (list: ActiveInd[]) => setPrefs(slot === 'a' ? { indA: list } : { indB: list });

  return (
    <div className="chart-panel">
      <div className="chart-head">
        <span className="symbol">XAUUSD</span>
        <div className="seg" role="group" aria-label="Zaman dilimi">
          {TFS.map((t) => (
            <button key={t} aria-pressed={t === tf} onClick={() => setTf(t)}>
              {TF_LABEL[t]}
            </button>
          ))}
        </div>
        <button className="btn sm ghost" onClick={() => setPicker(true)}>
          <Icon name="wave" size={16} /> İndikatör
        </button>
        <div className="legend">
          {inds.map((ind) => {
            const def = IND_BY_ID[ind.id];
            if (!def) return null;
            const v = values[ind.uid];
            const showVals = def.pane === 'separate' && v;
            return (
              <span key={ind.uid} className={`chip ${ind.hidden ? 'off' : ''}`}>
                <span className="sw" style={{ background: ind.colors[0] ?? SERIES[0] }} />
                <span>
                  {def.short}
                  {def.params.length ? ` ${def.params.map((p) => ind.params[p.key]).join(' ')}` : ''}
                </span>
                {showVals &&
                  def.outputs.slice(0, 3).map((o, i) => (
                    <span key={o.key} style={{ color: ind.colors[i] }}>
                      {Number.isFinite(v[o.key]) ? fmtVal(v[o.key]) : '—'}
                    </span>
                  ))}
                <button title="Ayarlar" onClick={(e) => setEditing({ uid: ind.uid, x: e.clientX, y: e.clientY })}>
                  <Icon name="sliders" size={12} />
                </button>
                <button title={ind.hidden ? 'Göster' : 'Gizle'} onClick={() => setInds(inds.map((x) => (x.uid === ind.uid ? { ...x, hidden: !x.hidden } : x)))}>
                  <Icon name={ind.hidden ? 'eyeOff' : 'eye'} size={12} />
                </button>
                <button title="Kaldır" onClick={() => setInds(inds.filter((x) => x.uid !== ind.uid))}>
                  <Icon name="close" size={12} />
                </button>
              </span>
            );
          })}
        </div>
      </div>
      <div className="chart-host" onContextMenu={onContext} onPointerDown={() => setMenu(null)}>
        <div ref={hostRef} className="chart-canvas" />
        <div className="chart-overlay">
          <svg>
            <defs>
              <clipPath id={`clip-${slot}`}>
                <rect x={0} y={0} width={width} height={paneH} />
              </clipPath>
            </defs>
            <g clipPath={`url(#clip-${slot})`} style={{ pointerEvents: tool === 'cursor' ? undefined : 'none' }}>
              {drawings.map(renderDrawing)}
            </g>
          </svg>
          {tool !== 'cursor' && <div className="draw-capture" onPointerDown={onDrawDown} onPointerMove={onDrawMove} onPointerUp={onDrawUp} />}
          {ctrl &&
            lines.map((l) => {
              const y = ctrl.priceToY(l.price);
              if (y == null || y < -10 || y > paneH + 10) return null;
              return (
                <div key={l.key} className={`oline ${l.cls}`} style={{ transform: `translateY(${y}px)` }}>
                  {l.draggable && <div className="hit" onPointerDown={startDrag(l)} />}
                  <div className="tag" onPointerDown={startDrag(l)}>
                    <span className="k">{l.k}</span>
                    <span className="v">{l.v}</span>
                    {l.missing?.map((f) => (
                      <button
                        key={f}
                        className={`add ${f}`}
                        title={`${f === 'sl' ? 'SL' : 'TP'} ekle: tıkla ya da sürükle`}
                        onPointerDown={startDragOut(l, f)}
                      >
                        {f === 'sl' ? 'SL' : 'TP'}
                      </button>
                    ))}
                    {l.onClose && (
                      <button title={l.closeTitle} onPointerDown={(e) => e.stopPropagation()} onClick={l.onClose}>
                        <Icon name="close" size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          {fx.map((f) =>
            f.kind === 'bar' ? (
              <span key={f.id} className="fx-pulse" style={{ left: f.x, top: f.y }} />
            ) : f.kind === 'fill' ? (
              <span key={f.id} className="fx-ring big" style={{ left: f.x, top: f.y }} />
            ) : (
              <span key={f.id} className={`fx-sweep ${f.kind}`} style={{ top: f.y }} />
            ),
          )}
        </div>
      </div>
      {menu && (
        <ChartMenu
          {...menu}
          price={menu.price}
          current={live.price}
          onClose={() => setMenu(null)}
        />
      )}
      {picker && <IndicatorPicker onClose={() => setPicker(false)} onAdd={(ind) => setInds([...inds, ind])} existing={inds} />}
      {editing && (
        <ParamPopover
          ind={inds.find((i) => i.uid === editing.uid)!}
          x={editing.x}
          y={editing.y}
          onChange={(ind) => setInds(inds.map((i) => (i.uid === ind.uid ? ind : i)))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function fmtVal(v: number) {
  const a = Math.abs(v);
  const d = a >= 1000 ? 0 : a >= 100 ? 1 : 2;
  if (a >= 1e6) return (v / 1e6).toFixed(2).replace('.', ',') + 'M';
  if (a >= 1e4) return (v / 1e3).toFixed(1).replace('.', ',') + 'K';
  return v.toFixed(d).replace('.', ',');
}

function ChartMenu({ x, y, price, current, onClose }: { x: number; y: number; price: number; current: number; onClose: () => void }) {
  const S = useApp.getState;
  const below = price < current;
  const act = (side: Side) => () => {
    S().openTicket(side, 'limit', price);
    onClose();
  };
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.menu')) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  return (
    <div className="menu" style={{ left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 200) }}>
      <div className="hint">Bu seviyeye emir</div>
      {below ? (
        <>
          <button onClick={act('long')}>
            <Icon name="up" size={16} style={{ color: C.up }} /> Long limit
          </button>
          <button onClick={act('short')}>
            <Icon name="down" size={16} style={{ color: C.down }} /> Short stop
          </button>
        </>
      ) : (
        <>
          <button onClick={act('short')}>
            <Icon name="down" size={16} style={{ color: C.down }} /> Short limit
          </button>
          <button onClick={act('long')}>
            <Icon name="up" size={16} style={{ color: C.up }} /> Long stop
          </button>
        </>
      )}
      <hr />
      <button
        onClick={() => {
          S().addDrawing({ id: uid(), kind: 'hline', a: { t: 0, p: price }, b: { t: 0, p: price } });
          onClose();
        }}
      >
        <Icon name="hline" size={16} /> Yatay çizgi
      </button>
    </div>
  );
}

