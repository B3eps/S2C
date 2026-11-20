import { useEffect, useMemo, useRef, useState } from 'react';
import type { SeriesMarker, Time } from 'lightweight-charts';
import { ChartController, LineSpec } from '../lib/chartController';
import { getFeed, marketBus, fxBus, shooter, useApp, ticketLots, pnlOf, riskOf, markPrice, spreadOf, Fx, LineTarget } from '../store';
import { TF, TFS, TF_LABEL, TF_MS, Drawing, Anchor, Side, uid } from '../lib/types';
import { TOOL_BY_KIND, FIB_LEVELS, regression, defaultStop } from '../lib/drawings';
import { IND_BY_ID, ActiveInd } from '../lib/indicators';
import { createSetupEngine, SetupResult } from '../lib/parcaSetup';
import { createGoldSetupEngine } from '../lib/parcaSetupGold';
import { isGoldId, isParcaId, parcaName, variantParams } from '../lib/parcaVariants';
import type { ParcaId } from '../lib/parcaVariants';
import { eventsBetween } from '../lib/calendar';
import { C, SERIES, alpha } from '../lib/theme';
import { goldPrice, lots as fmtLots, rMult, signedMoney } from '../lib/format';
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

/** last copied drawing, shared between panes (Ctrl+C / Ctrl+V / Ctrl+D) */
let drawingClip: Drawing | null = null;
const sideWord =(s: Side) => (s === 'long' ? 'Long' : 'Short');
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
  const spread = useApp((s) => spreadOf(s.settings));
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
      const floating = pnlOf(p.side, p.entry, markPrice(p.side, live.price, spread), p.lots);
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
  }, [session, ticket, live.price, account, spread]);
}

export function ChartPanel({ index }: { index: number }) {
  const primary = index === 0;
  const slot = `p${index}`;
  const hostRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<ChartController | null>(null);
  const prefs = useApp((s) => s.prefs);
  const setPane = useApp((s) => s.setPane);
  const tool = useApp((s) => s.tool);
  const showPrice = useApp((s) => s.showPrice);
  const editLine = useApp((s) => s.editing);
  const session = useApp((s) => s.session);
  const sessionTrades = useApp((s) => s.sessionTrades);
  const pane = prefs.panes[index];
  const tf: TF = pane.tf;
  const inds: ActiveInd[] = pane.ind;
  const setupInds = inds.filter((ind) => isParcaId(ind.id) && !ind.hidden);
  const [ver, setVer] = useState(0);
  const [barsLen, setBarsLen] = useState(0);
  const [setups, setSetups] = useState<Record<string, SetupResult>>({});
  const setupMemo = useRef(new Map<string, { engineKey: string; engine: ReturnType<typeof createSetupEngine>; key: string; result: SetupResult }>());
  const [values, setValues] = useState<Record<string, Record<string, number>>>({});
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<{ uid: string; x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; price: number } | null>(null);
  const [fx, setFx] = useState<(Fx & { id: string; x: number; y: number })[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ d: Drawing; stage: 'b' | 'c' } | null>(null);
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
    ctrl.setPriceMode(useApp.getState().showPrice, useApp.getState().session?.firstPrice ?? 0);
    const f = getFeed();
    if (f) {
      const bars = f.bars(tf);
      ctrl.context = { days: f.days() };
      ctrl.reset(bars, tf);
      setBarsLen(bars.length);
    }
    if (primary) shooter.fn = () => ctrl.screenshot();
    let sig = '';
    let raf = 0;
    const host = hostRef.current!;
    const refresh = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const next = ctrl.signature();
        if (sig !== next) { sig = next; setVer(v => v + 1); }
      });
    };
    const observer = new ResizeObserver(refresh);
    observer.observe(host);
    const onDrag = (e: PointerEvent) => { if (e.buttons) refresh(); };
    host.addEventListener('pointermove', onDrag);
    host.addEventListener('wheel', refresh, { passive: true });
    host.addEventListener('dblclick', refresh);
    ctrl.chart.timeScale().subscribeVisibleLogicalRangeChange(refresh);
    const unsubscribe = marketBus.on(refresh);
    refresh();
    return () => {
      unsubscribe();
      observer.disconnect();
      host.removeEventListener('pointermove', onDrag);
      host.removeEventListener('wheel', refresh);
      host.removeEventListener('dblclick', refresh);
      ctrl.chart.timeScale().unsubscribeVisibleLogicalRangeChange(refresh);
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
      ctrl.context = { days: f.days() };
      if (kind === 'reset') {
        ctrl.reset(bars, tf);
        setVer((v) => v + 1);
      } else ctrl.update(bars);
      setBarsLen(bars.length);
    });
  }, [tf]);

  // timeframe switch
  useEffect(() => {
    const f = getFeed();
    const ctrl = ctrlRef.current;
    if (!f || !ctrl) return;
    ctrl.context = { days: f.days() };
    ctrl.reset(f.bars(tf), tf);
    setBarsLen(f.bars(tf).length);
    // the drawing layer read the old timeframe's bars during this render: draw it again
    setSelected(null);
    setDraft(null);
    setVer((v) => v + 1);
    requestAnimationFrame(() => setVer((v) => v + 1));
  }, [tf]);

  // price: hidden as an index by default, real on demand
  const anchor = session?.firstPrice ?? 0;
  useEffect(() => {
    ctrlRef.current?.setPriceMode(showPrice, anchor);
  }, [showPrice, anchor]);

  // indicators
  const indKey = JSON.stringify(inds);
  useEffect(() => {
    ctrlRef.current?.setIndicators(inds);
    const t = setTimeout(() => setVer((v) => v + 1), 150);
    return () => clearTimeout(t);
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
    if (!setupInds.length) for (const e of eventsBetween(first, f.clock)) {
      m.push({ time: ctrl.bucket(e.t), position: 'aboveBar', shape: 'square', color: C.gold, text: e.label, size: 0.7 });
    }
    const activeSetupUids = new Set(setupInds.map((ind) => ind.uid));
    let setupChanged = false;
    for (const [uid] of setupMemo.current) if (!activeSetupUids.has(uid)) {
      setupMemo.current.delete(uid);
      setupChanged = true;
    }
    for (const ind of setupInds) {
      // Each variant has its own causal engine and its own closed-candle marks.
      const params = variantParams(ind.id as ParcaId, ind.params);
      const closedBars = Math.floor(f.clock / TF_MS[tf]);
      const key = `${tf}|${first}|${closedBars}|${Math.floor(f.clock / 3_600_000)}|${JSON.stringify(params)}`;
      let memo = setupMemo.current.get(ind.uid);
      if (memo?.key !== key) {
        const engineKey = `${tf}|${first}|${JSON.stringify(params)}`;
        const engine = memo?.engineKey === engineKey ? memo.engine : isGoldId(ind.id) ? createGoldSetupEngine(tf, ind.params, ind.id as ParcaId) : createSetupEngine(tf, ind.params);
        const result = engine({ bars: ctrl.bars, clock: f.clock, days: f.days(), series: { '5m': f.bars('5m'), '15m': f.bars('15m'), '1h': f.bars('1h'), '4h': f.bars('4h') } });
        memo = { engineKey, engine, key, result };
        setupMemo.current.set(ind.uid, memo);
        setupChanged = true;
      }
      for (const mark of memo!.result.marks) {
        if (mark.kind !== 'signal') continue;
        m.push({
          time: ctrl.bucket(mark.t), position: mark.side === 'long' ? 'belowBar' : 'aboveBar',
          shape: mark.side === 'long' ? 'arrowUp' : 'arrowDown',
          color: mark.side === 'long' ? C.up : C.down,
          size: 1.6,
        });
      }
    }
    if (setupChanged) setSetups(Object.fromEntries([...setupMemo.current].map(([uid, memo]) => [uid, { ...memo.result }])));
    ctrl.setMarkers(m.filter((x) => (x.time as number) * 1000 >= first));
  }, [sessionTrades, session?.positions.length, barsLen, tf, session, indKey]);

  // fx
  useEffect(() => {
    return fxBus.on((e) => {
      const ctrl = ctrlRef.current;
      if (!ctrl) return;
      if ((e.kind === 'bar' && (!primary || (useApp.getState().playing && useApp.getState().prefs.speed >= 3))) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
      const typing = !!(e.target as HTMLElement).closest('input,textarea');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !typing && (e.key === 'c' || e.key === 'v' || e.key === 'd')) {
        if (e.key === 'c' || e.key === 'd') {
          const d = useApp.getState().session?.drawings.find((x) => x.id === selected);
          if (d) drawingClip = d;
          if (e.key === 'c' || !d) return;
        }
        if (!drawingClip || !primary) return;
        e.preventDefault();
        const dt = TF_MS[tf] * 3;
        const sh = (a: Anchor) => ({ t: a.t + dt, p: a.p });
        const copy: Drawing = { ...drawingClip, id: uid(), a: sh(drawingClip.a), b: sh(drawingClip.b), ...(drawingClip.c ? { c: sh(drawingClip.c) } : {}), locked: false };
        drawingClip = copy;
        useApp.getState().addDrawing(copy);
        setSelected(copy.id);
        return;
      }
      if (!selected) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && !(e.target as HTMLElement).closest('input,textarea')) {
        useApp.getState().removeDrawing(selected);
        setSelected(null);
      }
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, primary, tf]);

  const ctrl = ctrlRef.current;
  const S = useApp.getState;
  const localXY = (e: { clientX: number; clientY: number }) => {
    const r = hostRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const magnet = prefs.magnet !== false;
  const toAnchor = (e: { clientX: number; clientY: number; altKey?: boolean }, snap = true) => {
    const { x, y } = localXY(e);
    if (snap && magnet && !e.altKey) {
      const s = ctrl?.snap(x, y);
      if (s) return s;
    }
    const t = ctrl?.xToTime(x);
    const p = ctrl?.yToPrice(y);
    if (t == null || p == null) return null;
    return { t, p };
  };

  // ── line drag ──
  const moved = useRef(false);
  const startDrag = (l: OLine) => (e: React.PointerEvent) => {
    moved.current = false;
    if (!l.draggable || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const y0 = e.clientY;
    const move = (ev: PointerEvent) => {
      if (!moved.current && Math.abs(ev.clientY - y0) < 3) return;
      moved.current = true;
      const p = ctrlRef.current?.yToPrice(localXY(ev).y);
      if (p != null) S().moveLine(l.target, p);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      if (moved.current) S().commitLine();
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

  // ── drawing creation: 1, 2 or 3 anchors ──
  const finishDraft = (d: Drawing) => {
    S().addDrawing(d);
    setSelected(d.id);
    setDraft(null);
    S().setTool('cursor');
  };
  const onDrawDown = (e: React.PointerEvent) => {
    if (tool === 'cursor' || e.button !== 0) return;
    const a = toAnchor(e);
    if (!a) return;
    const def = TOOL_BY_KIND[tool];
    if (draft?.stage === 'c') {
      finishDraft({ ...draft.d, c: a });
      return;
    }
    if (def.points === 1) {
      finishDraft({ id: uid(), kind: tool, a, b: a, ...(tool === 'text' ? { text: 'Not' } : {}) });
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraft({ d: { id: uid(), kind: tool, a, b: a }, stage: 'b' });
  };
  const onDrawMove = (e: React.PointerEvent) => {
    if (!draft) return;
    const p = toAnchor(e);
    if (!p) return;
    setDraft(draft.stage === 'b' ? { ...draft, d: { ...draft.d, b: p } } : { ...draft, d: { ...draft.d, c: p } });
  };
  const onDrawUp = () => {
    if (!draft || draft.stage !== 'b') return;
    const c = ctrlRef.current;
    const d = draft.d;
    const far =
      Math.abs((c?.timeToX(d.a.t) ?? 0) - (c?.timeToX(d.b.t) ?? 0)) > 3 || Math.abs((c?.priceToY(d.a.p) ?? 0) - (c?.priceToY(d.b.p) ?? 0)) > 3;
    if (!far) {
      setDraft(null);
      return;
    }
    const def = TOOL_BY_KIND[d.kind];
    if (def.points === 3) setDraft({ d: { ...d, c: d.b }, stage: 'c' });
    else if (d.kind === 'longpos' || d.kind === 'shortpos') finishDraft({ ...d, c: { t: d.b.t, p: defaultStop(d.a.p, d.b.p) } });
    else finishDraft(d);
  };
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setDraft(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  const dragHandle = (d: Drawing, which: 'a' | 'b' | 'c' | 'both') => (e: React.PointerEvent) => {
    if (tool !== 'cursor') return;
    e.stopPropagation();
    e.preventDefault();
    setSelected(d.id);
    if (d.locked) return;
    const el = e.currentTarget as Element;
    el.setPointerCapture(e.pointerId);
    const start = toAnchor(e, false);
    const move = (ev: PointerEvent) => {
      const p = toAnchor(ev, which !== 'both');
      if (!p || !start) return;
      if (which === 'both') {
        const dt = p.t - start.t;
        const dp = p.p - start.p;
        const sh = (x: Anchor) => ({ t: x.t + dt, p: x.p + dp });
        S().updateDrawing({ ...d, a: sh(d.a), b: sh(d.b), ...(d.c ? { c: sh(d.c) } : {}) });
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
  const scaleW = ctrl?.priceScaleWidth() ?? 0;
  const plotW = Math.max(0, width - scaleW);
  const paneH = ctrl?.mainPaneHeight() ?? 0;
  const drawings = [...(session?.drawings ?? []), ...(draft ? [draft.d] : [])];
  const visibleSignals = ctrl ? setupInds.flatMap((ind) => (setups[ind.uid]?.marks ?? [])
    .filter((mark) => mark.kind === 'signal' && mark.t >= ctrl.bars[0]?.t)
    .map((mark) => ({ mark, id: ind.id as ParcaId })))
    .sort((a, b) => a.mark.t - b.mark.t).slice(-32) : [];
  // Setup signals show their price plan only; they never create or size an order.
  const liveSetups: { id: ParcaId; side: 'long' | 'short'; entry: number; stop: number; target: number; strong: boolean; t: number; rr: number; liqR?: number }[] = [];
  if (ctrl) for (const ind of setupInds) {
    const sig = [...(setups[ind.uid]?.marks ?? [])].reverse().find((x) => x.kind === 'signal' && x.entry !== undefined);
    if (!sig) continue;
    const b = ctrl.bars;
    let at = b.length - 1;
    while (at >= 0 && b[at].t > sig.t) at--;
    if (at < 0 || b[at].t !== sig.t || b.length - 1 - at > 60) continue;
    const long = sig.side === 'long';
    let done = false;
    for (let k = at + 1; k < b.length && !done; k++) done = long ? b[k].l <= sig.stop! || b[k].h >= sig.target! : b[k].h >= sig.stop! || b[k].l <= sig.target!;
    if (!done) liveSetups.push({ id: ind.id as ParcaId, side: sig.side, entry: sig.entry!, stop: sig.stop!, target: sig.target!, strong: !!sig.strong, t: sig.t,
      liqR: sig.liqR, rr: Math.round(Math.abs(sig.target! - sig.entry!) / Math.abs(sig.entry! - sig.stop!) * 10) / 10 });
  }
  void ver;

  const renderDrawing = (d: Drawing) => {
    if (!ctrl) return null;
    const W = plotW;
    const X = (t: number) => ctrl.timeToX(t);
    const Y = (p: number) => ctrl.priceToY(p);
    const ax = X(d.a.t);
    const ay = Y(d.a.p);
    const bx = X(d.b.t);
    const by = Y(d.b.p);
    if (ax == null || ay == null || bx == null || by == null) return null;
    const sel = selected === d.id;
    const cls = `dline ${sel ? 'sel' : ''}`;
    const body = dragHandle(d, 'both');
    const H = (which: 'a' | 'b' | 'c', x: number, y: number) =>
      sel ? <rect key={which} x={x - 4} y={y - 4} width={8} height={8} className="dhandle" onPointerDown={dragHandle(d, which)} /> : null;
    /** a line through two points, cut at the plot edges */
    const ext = (x1: number, y1: number, x2: number, y2: number, mode: 'right' | 'both' | 'dir') => {
      const dx = x2 - x1;
      if (Math.abs(dx) < 1e-6) return { x1, y1: 0, x2, y2: paneH };
      const k = (y2 - y1) / dx;
      const at = (x: number) => y1 + k * (x - x1);
      if (mode === 'both') return { x1: 0, y1: at(0), x2: W, y2: at(W) };
      if (mode === 'right') return { x1, y1, x2: W, y2: at(W) };
      const edge = dx > 0 ? W : 0;
      return { x1, y1, x2: edge, y2: at(edge) };
    };
    const Line = (l: { x1: number; y1: number; x2: number; y2: number }, key: string, extra = '') => (
      <g key={key}>
        <line {...l} className="dhit" onPointerDown={body} />
        <line {...l} className={`${cls} ${extra}`} style={{ pointerEvents: 'none', ...(d.color ? { stroke: d.color } : {}), ...(d.width ? { strokeWidth: d.width } : {}) }} />
      </g>
    );
    const Label = (x: number, y: number, text: string, key: string, anchor: 'start' | 'end' | 'middle' = 'start', tone = '') => (
      <text key={key} x={x} y={y} className={`dlabel ${tone}`} textAnchor={anchor}>
        {text}
      </text>
    );
    const tfMs = TF_MS[tf];
    const pctTxt = (from: number, to: number) => {
      const v = ((to - from) / from) * 100;
      return `${v >= 0 ? '+' : '−'}%${Math.abs(v).toFixed(2).replace('.', ',')}`;
    };

    switch (d.kind) {
      case 'trend':
        return <g key={d.id}>{Line({ x1: ax, y1: ay, x2: bx, y2: by }, 'l')}{H('a', ax, ay)}{H('b', bx, by)}</g>;
      case 'arrow': {
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const ux = (bx - ax) / len;
        const uy = (by - ay) / len;
        const hs = 9 + (d.width ?? 1) * 1.5;
        const p1 = `${bx - ux * hs - uy * hs * 0.5},${by - uy * hs + ux * hs * 0.5}`;
        const p2 = `${bx - ux * hs + uy * hs * 0.5},${by - uy * hs - ux * hs * 0.5}`;
        return (
          <g key={d.id}>
            {Line({ x1: ax, y1: ay, x2: bx - ux * 2, y2: by - uy * 2 }, 'l')}
            <polygon points={`${bx},${by} ${p1} ${p2}`} className="darrow" style={{ pointerEvents: 'none', fill: d.color ?? (sel ? 'var(--ink-1)' : 'var(--ink-2)') }} />
            {H('a', ax, ay)}
            {H('b', bx, by)}
          </g>
        );
      }
      case 'ray':
        return <g key={d.id}>{Line(ext(ax, ay, bx, by, 'dir'), 'l')}{H('a', ax, ay)}{H('b', bx, by)}</g>;
      case 'extended':
        return <g key={d.id}>{Line(ext(ax, ay, bx, by, 'both'), 'l')}{H('a', ax, ay)}{H('b', bx, by)}</g>;
      case 'text':
        return (
          <g key={d.id}>
            <text x={ax + 6} y={ay - 6} className="dtext" style={d.color ? { fill: d.color } : undefined} onPointerDown={body}>
              {d.text || 'Not'}
            </text>
            <circle cx={ax} cy={ay} r={3} className="dpin" style={d.color ? { fill: d.color } : undefined} />
            {H('a', ax, ay)}
          </g>
        );
      case 'hline':
        return <g key={d.id}>{Line({ x1: 0, y1: ay, x2: W, y2: ay }, 'l')}{H('a', Math.min(Math.max(ax, 8), W - 8), ay)}</g>;
      case 'hray':
        return <g key={d.id}>{Line({ x1: ax, y1: ay, x2: W, y2: ay }, 'l')}{H('a', ax, ay)}</g>;
      case 'vline':
        return <g key={d.id}>{Line({ x1: ax, y1: 0, x2: ax, y2: paneH }, 'l')}{H('a', ax, ay)}</g>;
      case 'cross':
        return (
          <g key={d.id}>
            {Line({ x1: 0, y1: ay, x2: W, y2: ay }, 'h')}
            {Line({ x1: ax, y1: 0, x2: ax, y2: paneH }, 'v')}
            {H('a', ax, ay)}
          </g>
        );
      case 'rect':
        return (
          <g key={d.id}>
            <rect x={Math.min(ax, bx)} y={Math.min(ay, by)} width={Math.abs(bx - ax)} height={Math.abs(by - ay)} className={`drect ${sel ? 'sel' : ''}`} onPointerDown={body} />
            {H('a', ax, ay)}
            {H('b', bx, by)}
          </g>
        );
      case 'channel': {
        const main = { x1: ax, y1: ay, x2: bx, y2: by };
        if (!d.c) return <g key={d.id}>{Line(main, 'l')}</g>;
        const cx = X(d.c.t) ?? bx;
        const cy = Y(d.c.p) ?? by;
        const k = bx === ax ? 0 : (by - ay) / (bx - ax);
        const off = cy - (ay + k * (cx - ax));
        const par = { x1: ax, y1: ay + off, x2: bx, y2: by + off };
        return (
          <g key={d.id}>
            <polygon points={`${ax},${ay} ${bx},${by} ${bx},${by + off} ${ax},${ay + off}`} className="dfill" onPointerDown={body} />
            {Line(main, 'm')}
            {Line(par, 'p')}
            {Line({ x1: ax, y1: ay + off / 2, x2: bx, y2: by + off / 2 }, 'mid', 'dashed')}
            {H('a', ax, ay)}
            {H('b', bx, by)}
            {H('c', cx, cy)}
          </g>
        );
      }
      case 'regression': {
        const r = regression(ctrl.bars, d.a.t, d.b.t);
        if (!r) return <g key={d.id}>{Line({ x1: ax, y1: ay, x2: bx, y2: by }, 'l', 'dashed')}</g>;
        const x1 = X(r.t1) ?? ax;
        const x2 = X(r.t2) ?? bx;
        const yy = (t: number, k: number) => Y(r.at(t) + k * r.sd) ?? 0;
        const up = { x1, y1: yy(r.t1, 2), x2, y2: yy(r.t2, 2) };
        const lo = { x1, y1: yy(r.t1, -2), x2, y2: yy(r.t2, -2) };
        return (
          <g key={d.id}>
            <polygon points={`${up.x1},${up.y1} ${up.x2},${up.y2} ${lo.x2},${lo.y2} ${lo.x1},${lo.y1}`} className="dfill" onPointerDown={body} />
            {Line({ x1, y1: yy(r.t1, 0), x2, y2: yy(r.t2, 0) }, 'c')}
            {Line(up, 'u', 'dashed')}
            {Line(lo, 'd', 'dashed')}
            {H('a', x1, yy(r.t1, 0))}
            {H('b', x2, yy(r.t2, 0))}
          </g>
        );
      }
      case 'pitchfork': {
        if (!d.c) return <g key={d.id}>{Line({ x1: ax, y1: ay, x2: bx, y2: by }, 'l', 'dashed')}</g>;
        const cx = X(d.c.t) ?? bx;
        const cy = Y(d.c.p) ?? by;
        const mx = (bx + cx) / 2;
        const my = (by + cy) / 2;
        const med = ext(ax, ay, mx, my, 'dir');
        const k = mx === ax ? 0 : (my - ay) / (mx - ax);
        const fwd = (x: number, y: number) => {
          const edge = mx >= ax ? W : 0;
          return { x1: x, y1: y, x2: edge, y2: y + k * (edge - x) };
        };
        return (
          <g key={d.id}>
            {Line(med, 'm')}
            {Line(fwd(bx, by), 'u')}
            {Line(fwd(cx, cy), 'd')}
            {Line({ x1: bx, y1: by, x2: cx, y2: cy }, 'bc', 'dashed')}
            {H('a', ax, ay)}
            {H('b', bx, by)}
            {H('c', cx, cy)}
          </g>
        );
      }
      case 'fib': {
        const x1 = Math.min(ax, bx);
        const lv = FIB_LEVELS.map((L) => ({ L, y: Y(d.b.p + (d.a.p - d.b.p) * L) ?? 0 }));
        return (
          <g key={d.id}>
            {lv.slice(1).map((l, i) => (
              <rect key={`f${i}`} x={x1} y={Math.min(l.y, lv[i].y)} width={W - x1} height={Math.abs(l.y - lv[i].y)} className={`dfib f${i % 2}`} onPointerDown={body} />
            ))}
            {lv.map((l) => (
              <g key={l.L}>
                {Line({ x1, y1: l.y, x2: W, y2: l.y }, `l${l.L}`, l.L === 0.5 || l.L === 0.618 ? 'strong' : '')}
                {Label(x1 + 4, l.y - 4, l.L.toFixed(3).replace('.', ','), `t${l.L}`)}
              </g>
            ))}
            {Line({ x1: ax, y1: ay, x2: bx, y2: by }, 'diag', 'dashed')}
            {H('a', ax, ay)}
            {H('b', bx, by)}
          </g>
        );
      }
      case 'longpos':
      case 'shortpos': {
        const stop = d.c?.p ?? defaultStop(d.a.p, d.b.p);
        const sy = Y(stop) ?? ay;
        const x1 = Math.min(ax, bx);
        const x2 = Math.max(Math.max(ax, bx), x1 + 120);
        const rr = Math.abs(d.b.p - d.a.p) / Math.max(1e-9, Math.abs(stop - d.a.p));
        return (
          <g key={d.id}>
            <rect x={x1} y={Math.min(ay, by)} width={x2 - x1} height={Math.abs(by - ay)} className="dpos win" onPointerDown={body} />
            <rect x={x1} y={Math.min(ay, sy)} width={x2 - x1} height={Math.abs(sy - ay)} className="dpos loss" onPointerDown={body} />
            <line x1={x1} x2={x2} y1={ay} y2={ay} className="dline" style={{ pointerEvents: 'none' }} />
            {Label(x1 + 6, by + (by < ay ? 14 : -6), `Hedef ${pctTxt(d.a.p, d.b.p)}`, 'tt', 'start', 'up')}
            {Label(x1 + 6, sy + (sy > ay ? -6 : 14), `Stop ${pctTxt(d.a.p, stop)}`, 'st', 'start', 'down')}
            {Label(x1 + 6, ay + (by < ay ? 14 : -6), `R:R 1 : ${rr.toFixed(2).replace('.', ',')}`, 'rr')}
            {H('a', x1, ay)}
            {H('b', x2, by)}
            {H('c', x2, sy)}
          </g>
        );
      }
      case 'measure': {
        const up = d.b.p >= d.a.p;
        const n = Math.round(Math.abs(d.b.t - d.a.t) / tfMs);
        return (
          <g key={d.id}>
            <rect x={Math.min(ax, bx)} y={Math.min(ay, by)} width={Math.abs(bx - ax)} height={Math.abs(by - ay)} className={`dpos ${up ? 'win' : 'loss'}`} onPointerDown={body} />
            <line x1={ax} y1={ay} x2={bx} y2={by} className="dline dashed" style={{ pointerEvents: 'none' }} />
            {Label((ax + bx) / 2, Math.min(ay, by) - 6, `${pctTxt(d.a.p, d.b.p)} · ${n} mum`, 'm', 'middle', up ? 'up' : 'down')}
            {H('a', ax, ay)}
            {H('b', bx, by)}
          </g>
        );
      }
    }
    return null;
  };

  const maxPane = useApp((s) => s.maxPane);
  const multi = prefs.count > 1;
  const separate = inds.filter((i) => IND_BY_ID[i.id]?.pane === 'separate');
  const rects = ctrl ? ctrl.paneRects() : [];
  const FOLD = 26;
  const setTf = (t: TF) => setPane(index, { tf: t });
  const setInds = (list: ActiveInd[]) => setPane(index, { ind: list });

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
        {multi && (
          <button
            className="icon-btn sm head-end"
            title={maxPane === index ? 'Tüm grafikleri göster' : 'Bu grafiği büyüt'}
            aria-pressed={maxPane === index}
            onClick={() => S().setMaxPane(maxPane === index ? null : index)}
          >
            <Icon name={maxPane === index ? 'shrink' : 'expand'} size={14} />
          </button>
        )}
        <div className="legend">
          {liveSetups.map((live) => <span key={live.id} className={`setup-signal-status ${live.side}`} role="status" aria-label={`Parça ${parcaName(live.id)} ${live.side === 'long' ? 'AL' : 'SAT'} sinyali`}>
            <span className="setup-signal-dot" />
            <span>{parcaName(live.id)}</span>
            <strong>{live.side === 'long' ? '↑ AL' : '↓ SAT'}{live.strong ? ' ★' : ''}</strong>
          </span>)}
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
                  {def.params.length ? ` ${def.params.slice(0, 3).map((p) => ind.params[p.key] ?? p.def).join(' ')}` : ''}
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
      <div
        className="chart-host"
        onContextMenu={onContext}
        onPointerDown={() => {
          setMenu(null);
          if (tool === 'cursor') setSelected(null);
        }}
      >
        <div ref={hostRef} className="chart-canvas" />
        <div className="chart-overlay">
          <svg>
            <defs>
              <clipPath id={`clip-${slot}`}>
                <rect x={0} y={0} width={plotW} height={paneH} />
              </clipPath>
            </defs>
            <g clipPath={`url(#clip-${slot})`} style={{ pointerEvents: 'none' }}>
              {visibleSignals.map(({ mark, id }) => {
                const x = ctrl?.timeToX(mark.t);
                const bar = ctrl?.bars.find((item) => item.t === mark.t);
                if (x == null || !bar || x < 0 || x > plotW || paneH < 50) return null;
                const long = mark.side === 'long';
                const tone = long ? C.up : C.down;
                const barY = ctrl?.priceToY(long ? bar.l : bar.h);
                if (barY == null) return null;
                const pct = mark.prob !== undefined ? ` %${Math.round(mark.prob * 100)}` : '';
                const w = (mark.strong ? 110 : 94) + (pct ? 30 : 0) + (id === 'parca-setup-gold-a' ? 18 : 0) + (id === 'parca-trained-1m' ? 38 : 0);
                const left = Math.max(2, Math.min(x - w / 2, plotW - w - 2));
                const gold = isGoldId(id);
                const labelOffset = long ? (gold ? 48 : 22) : (gold ? -69 : -43);
                const top = Math.max(3, Math.min(barY + labelOffset, paneH - 24));
                return (
                  <g key={`${id}-${mark.t}-${mark.side}`}>
                    <line x1={x} x2={x} y1={long ? barY + 5 : barY - 5} y2={long ? top : top + 22} stroke={tone} strokeWidth={1.5} />
                    <rect x={left} y={top} width={w} height={22} rx={3} fill={tone} stroke={gold ? C.goldStrong : C.ply0} strokeWidth={gold ? 2 : 1.5} />
                    <text x={left + w / 2} y={top + 15} textAnchor="middle" style={{ fill: C.ply0, fontSize: 11, fontWeight: 800 }}>
                      {parcaName(id)} {long ? '↑ AL' : '↓ SAT'}{mark.strong ? ' ★' : ''}{pct}
                    </text>
                  </g>
                );
              })}
            </g>
            <g clipPath={`url(#clip-${slot})`} style={{ pointerEvents: 'none' }}>
              {liveSetups.map((live) => {
                if (!ctrl) return null;
                const x0 = ctrl.timeToX(live.t);
                const ye = ctrl.priceToY(live.entry), ys = ctrl.priceToY(live.stop), yt = ctrl.priceToY(live.target);
                if (x0 == null || ye == null || ys == null || yt == null) return null;
                const x1 = Math.max(0, Math.min(x0, plotW - 60));
                const gold = isGoldId(live.id);
                const tone = gold ? C.goldStrong : live.side === 'long' ? C.up : C.down;
                // the three presets stack their tags side by side, each 200 px wide
                const slotN = live.id === 'parca-trained-1m' ? 3 : live.id === 'parca-setup-gold-a' ? 2 : gold ? 1 : 0;
                const tagX = Math.max(2, plotW - 204 * (slotN + 1));
                const rightLine = (priceY: number, name: string, color: string, dash: string, offset = 0) => {
                  const y = Math.max(11, Math.min(paneH - 11, priceY));
                  const yy = Math.max(11, Math.min(paneH - 11, y + offset));
                  return <g key={name}>
                    <line x1={x1} x2={plotW} y1={priceY} y2={priceY} stroke={color} strokeWidth={name === 'GİRİŞ' ? 1.5 : 1} strokeDasharray={dash} />
                    <rect x={tagX} y={yy - 9} width={200} height={18} rx={3} fill={color} />
                    <text x={tagX + 100} y={yy + 4} textAnchor="middle" style={{ fill: C.ply0, fontSize: 11, fontWeight: 800 }}>
                      {parcaName(live.id)} {name}
                    </text>
                  </g>;
                };
                return (
                  <g key={live.id}>
                    {rightLine(ye, 'GİRİŞ', tone, 'none')}
                    {rightLine(ys, 'STOP', C.down, '5 3')}
                    {rightLine(yt, 'HEDEF', C.up, '5 3')}
                  </g>
                );
              })}
            </g>
            <g clipPath={`url(#clip-${slot})`} style={{ pointerEvents: tool === 'cursor' ? undefined : 'none' }}>
              {drawings.map(renderDrawing)}
            </g>
          </svg>
          {(() => {
            const d = session?.drawings.find((x) => x.id === selected);
            if (!d || !ctrl || tool !== 'cursor') return null;
            const ax = ctrl.timeToX(d.a.t);
            const ay = ctrl.priceToY(d.a.p);
            if (ax == null || ay == null) return null;
            const upd = (p: Partial<Drawing>) => S().updateDrawing({ ...d, ...p });
            const SW = [undefined, C.ink1, C.up, C.down, C.warn, '#8ea3a8'];
            return (
              <div className="dtool" style={{ left: Math.max(4, Math.min(ax - 10, plotW - 250)), top: Math.max(4, ay - 44) }} onPointerDown={(e) => e.stopPropagation()}>
                {d.kind === 'text' && (
                  <input className="input" autoFocus value={d.text ?? ''} maxLength={60} placeholder="Not" onChange={(e) => upd({ text: e.target.value })} />
                )}
                {SW.map((c, i) => (
                  <button key={i} className={`sw ${d.color === c ? 'on' : ''}`} title={c ? 'Renk' : 'Varsayılan renk'} style={{ background: c ?? 'var(--ink-2)' }} onClick={() => upd({ color: c })} />
                ))}
                <button title={`Kalınlık: ${d.width ?? 1}`} className="wbtn" onClick={() => upd({ width: ((d.width ?? 1) % 3) + 1 })}>
                  <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8h12" stroke="currentColor" strokeWidth={d.width ?? 1} strokeLinecap="round" /></svg>
                </button>
                <button title={d.locked ? 'Kilidi aç' : 'Kilitle'} aria-pressed={!!d.locked} onClick={() => upd({ locked: !d.locked })}>
                  <Icon name="lock" size={14} />
                </button>
                <button
                  title="Kopyala"
                  onClick={() => {
                    const dt = TF_MS[tf] * 3;
                    const sh = (a: Anchor) => ({ t: a.t + dt, p: a.p });
                    const copy: Drawing = { ...d, id: uid(), a: sh(d.a), b: sh(d.b), ...(d.c ? { c: sh(d.c) } : {}), locked: false };
                    S().addDrawing(copy);
                    setSelected(copy.id);
                  }}
                >
                  <Icon name="copy" size={14} />
                </button>
                <button
                  title="Sil"
                  onClick={() => {
                    S().removeDrawing(d.id);
                    setSelected(null);
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            );
          })()}
          {rects.slice(1).map((r, k) => {
            const ind = separate[k];
            const def = ind && IND_BY_ID[ind.id];
            const folded = r.height <= FOLD + 4;
            return (
              <div key={k} className="pane-bar" style={{ top: r.top + 3, right: scaleW + 6 }}>
                <span>{def ? def.short : ''}</span>
                <button
                  title={folded ? 'Paneli aç' : 'Paneli küçült'}
                  onClick={() => {
                    ctrl?.setPaneMode(k + 1, 'toggle');
                    requestAnimationFrame(() => requestAnimationFrame(() => setVer((v) => v + 1)));
                    setTimeout(() => setVer((v) => v + 1), 120);
                  }}
                >
                  <Icon name={folded ? 'expand' : 'shrink'} size={12} />
                </button>
                <button
                  title="Bu paneli büyüt"
                  onClick={() => {
                    ctrl?.setPaneMode(k + 1, 'max');
                    requestAnimationFrame(() => requestAnimationFrame(() => setVer((v) => v + 1)));
                    setTimeout(() => setVer((v) => v + 1), 120);
                  }}
                >
                  <Icon name="chevron" size={12} />
                </button>
              </div>
            );
          })}
          {tool !== 'cursor' && <div className="draw-capture" onPointerDown={onDrawDown} onPointerMove={onDrawMove} onPointerUp={onDrawUp} />}
          {ctrl &&
            lines.map((l) => {
              const y = ctrl.priceToY(l.price);
              if (y == null || y < -10 || y > paneH + 10) return null;
              return (
                <div key={l.key} className={`oline ${l.cls}`} style={{ transform: `translateY(${y}px)`, right: scaleW }}>
                  {l.draggable && <div className="hit" onPointerDown={startDrag(l)} />}
                  <div
                    className={`tag ${editLine && editLine.id === l.target.id && l.target.kind !== 'ticket' ? 'sel' : ''}`}
                    onPointerDown={startDrag(l)}
                    onClick={() => {
                      if (moved.current || l.target.kind === 'ticket' || !l.target.id) return;
                      S().selectLine({ kind: l.target.kind, id: l.target.id });
                    }}
                    title={l.target.kind !== 'ticket' ? 'Düzenlemek için tıkla, taşımak için sürükle' : undefined}
                  >
                    <span className="k">{l.k}</span>
                    <span className="v">{showPrice ? `${l.v} · ${goldPrice(l.price)}` : l.v}</span>
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
              <span key={f.id} className={`fx-sweep ${f.kind}`} style={{ top: f.y, right: scaleW }} />
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
          const t = getFeed()?.clock ?? 0;
          S().addDrawing({ id: uid(), kind: 'hline', a: { t, p: price }, b: { t, p: price } });
          onClose();
        }}
      >
        <Icon name="hline" size={16} /> Yatay çizgi
      </button>
    </div>
  );
}

