import { useEffect, useMemo, useRef, useState } from 'react';
import type { SeriesMarker, Time } from 'lightweight-charts';
import { ChartController, LineSpec } from '../lib/chartController';
import { getFeed, marketBus, fxBus, shooter, useApp, ticketLots, pnlOf, riskOf, markPrice, spreadOf, Fx, LineTarget } from '../store';
import { TF, TFS, TF_LABEL, TF_MS, Drawing, Anchor, Side, uid } from '../lib/types';
import { TOOL_BY_KIND, defaultStop } from '../lib/drawings';
import { drawingShapes, hitShapes, Shape, Handle, SceneEnv } from '../lib/drawingScene';
import { OverlayPrimitive } from '../lib/overlayPrimitive';
import { instrumentOf } from '../lib/instruments';
import type { SetupMark } from '../lib/parcaSetup';
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

type LiveSetup = { id: ParcaId; side: 'long' | 'short'; entry: number; stop: number; target: number; strong: boolean; t: number; rr: number; liqR?: number };
/** Everything the canvas overlay paints, refreshed on every React render. */
interface OverlayState {
  drawings: Drawing[];
  selected: string | null;
  signals: { mark: SetupMark; id: ParcaId }[];
  live: LiveSetup[];
}

/** Index of the bar opening at `t`, or -1. */
function barAt(bars: { t: number }[], t: number) {
  let lo = 0, hi = bars.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].t === t) return mid;
    if (bars[mid].t < t) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}

/** Parça signal labels and the price plan of a still-open signal, as canvas shapes. */
function setupShapes(ctrl: ChartController, s: OverlayState, W: number, H: number): Shape[] {
  const out: Shape[] = [];
  const tag = (x: number, y: number, w: number, h: number, fill: string, text: string, stroke?: string, sw?: number) => {
    out.push({ k: 'box', x, y, w, h, fill, stroke, sw, r: 3 });
    out.push({ k: 'text', x: x + w / 2, y: y + h / 2 + 4, text, color: C.ply0, size: 11, weight: 800, align: 'center' });
  };
  if (H >= 50) for (const { mark, id } of s.signals) {
    const x = ctrl.timeToX(mark.t);
    const i = barAt(ctrl.bars, mark.t);
    if (x == null || i < 0 || x < 0 || x > W) continue;
    const bar = ctrl.bars[i];
    const long = mark.side === 'long';
    const tone = long ? C.up : C.down;
    const barY = ctrl.priceToY(long ? bar.l : bar.h);
    if (barY == null) continue;
    const pct = mark.prob !== undefined ? ` %${Math.round(mark.prob * 100)}` : '';
    const w = (mark.strong ? 110 : 94) + (pct ? 30 : 0) + (id === 'parca-setup-gold-a' ? 18 : 0) + (id === 'parca-trained-1m' ? 38 : 0);
    const left = Math.max(2, Math.min(x - w / 2, W - w - 2));
    const gold = isGoldId(id);
    const top = Math.max(3, Math.min(barY + (long ? (gold ? 48 : 22) : gold ? -69 : -43), H - 24));
    out.push({ k: 'line', x1: x, y1: long ? barY + 5 : barY - 5, x2: x, y2: long ? top : top + 22, color: tone, width: 1.5 });
    tag(left, top, w, 22, tone, `${parcaName(id)} ${long ? '↑ AL' : '↓ SAT'}${mark.strong ? ' ★' : ''}${pct}`, gold ? C.goldStrong : C.ply0, gold ? 2 : 1.5);
  }
  for (const live of s.live) {
    const x0 = ctrl.timeToX(live.t);
    const ye = ctrl.priceToY(live.entry), ys = ctrl.priceToY(live.stop), yt = ctrl.priceToY(live.target);
    if (x0 == null || ye == null || ys == null || yt == null) continue;
    const x1 = Math.max(0, Math.min(x0, W - 60));
    const gold = isGoldId(live.id);
    // the presets stack their tags side by side, each 200 px wide
    const slotN = live.id === 'parca-trained-1m' ? 3 : live.id === 'parca-setup-gold-a' ? 2 : gold ? 1 : 0;
    const tagX = Math.max(2, W - 204 * (slotN + 1));
    const row = (priceY: number, name: string, color: string, dash: boolean) => {
      out.push({ k: 'line', x1, y1: priceY, x2: W, y2: priceY, color, width: name === 'GİRİŞ' ? 1.5 : 1, dash });
      const y = Math.max(11, Math.min(H - 11, priceY));
      tag(tagX, y - 9, 200, 18, color, `${parcaName(live.id)} ${name}`);
    };
    row(ye, 'GİRİŞ', gold ? C.goldStrong : live.side === 'long' ? C.up : C.down, false);
    row(ys, 'STOP', C.down, true);
    row(yt, 'HEDEF', C.up, true);
  }
  return out;
}
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
  const overlayRef = useRef<OverlayPrimitive | null>(null);
  const overlayState = useRef<OverlayState>({ drawings: [], selected: null, signals: [], live: [] });
  /** order tag elements and their prices: moved by the overlay's paint, in step with the candles */
  const tagEls = useRef(new Map<string, { el: HTMLDivElement; price: number }>());

  // create chart
  useEffect(() => {
    const ctrl = new ChartController(hostRef.current!, tf);
    ctrlRef.current = ctrl;
    const overlay = new OverlayPrimitive(
      (W, H) => {
        const s = overlayState.current;
        const env: SceneEnv = { X: (t) => ctrl.timeToX(t), Y: (p) => ctrl.priceToY(p), W, H, bars: ctrl.bars, tfMs: TF_MS[ctrl.tf] };
        const out = setupShapes(ctrl, s, W, H);
        for (const d of s.drawings) out.push(...drawingShapes(d, env, s.selected === d.id));
        return out;
      },
      () => {
        const H = ctrl.mainPaneHeight();
        for (const { el, price } of tagEls.current.values()) {
          const y = ctrl.priceToY(price);
          const hide = y == null || y < -10 || y > H + 10;
          el.style.visibility = hide ? 'hidden' : '';
          if (!hide) el.style.transform = `translateY(${y}px)`;
        }
      },
    );
    ctrl.candles.attachPrimitive(overlay);
    overlayRef.current = overlay;
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
      ctrl.candles.detachPrimitive(overlay);
      overlayRef.current = null;
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

  // ── drawings live on the chart canvas: find what the pointer is over by geometry ──
  const hitDrawing = (e: { clientX: number; clientY: number }): { d: Drawing; which: 'body' | Handle } | null => {
    const c = ctrlRef.current;
    if (!c) return null;
    const { x, y } = localXY(e);
    const W = Math.max(0, (hostRef.current?.clientWidth ?? 0) - c.priceScaleWidth());
    const H = c.mainPaneHeight();
    if (x < 0 || y < 0 || x > W || y > H) return null;
    const env: SceneEnv = { X: (t) => c.timeToX(t), Y: (p) => c.priceToY(p), W, H, bars: c.bars, tfMs: TF_MS[tf] };
    const list = useApp.getState().session?.drawings ?? [];
    // the last drawn sits on top
    for (let i = list.length - 1; i >= 0; i--) {
      const which = hitShapes(drawingShapes(list[i], env, list[i].id === selected), x, y);
      if (which) return { d: list[i], which };
    }
    return null;
  };

  const onHostDownCapture = (e: React.PointerEvent) => {
    if (tool !== 'cursor' || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.oline, .dtool, .pane-bar')) return;
    const hit = hitDrawing(e);
    if (!hit) return;
    // keep the chart from panning: the drawing takes this pointer
    e.stopPropagation();
    e.preventDefault();
    setMenu(null);
    const { d, which } = hit;
    setSelected(d.id);
    if (d.locked) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const start = toAnchor(e, false);
    const move = (ev: PointerEvent) => {
      const p = toAnchor(ev, which !== 'body');
      if (!p || !start) return;
      if (which === 'body') {
        const dt = p.t - start.t;
        const dp = p.p - start.p;
        const sh = (x: Anchor) => ({ t: x.t + dt, p: x.p + dp });
        S().updateDrawing({ ...d, a: sh(d.a), b: sh(d.b), ...(d.c ? { c: sh(d.c) } : {}) });
      } else S().updateDrawing({ ...d, [which]: p });
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('drag-drawing');
    };
    el.classList.add('drag-drawing');
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  /** pointer feedback over a drawing; the chart's own cursor shows everywhere else */
  const onHostHover = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    const over = tool === 'cursor' && !e.buttons && !(e.target as HTMLElement).closest('.oline, .dtool, .pane-bar') ? hitDrawing(e) : null;
    el.classList.toggle('on-drawing', !!over && over.which === 'body');
    el.classList.toggle('on-handle', !!over && over.which !== 'body');
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
  const liveSetups: LiveSetup[] = [];
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

  // the canvas overlay reads this on its next paint
  overlayState.current = { drawings, selected, signals: visibleSignals, live: liveSetups };
  useEffect(() => { overlayRef.current?.update(); });

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
        <span className="symbol">{instrumentOf(session).symbol}</span>
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
        onPointerDownCapture={onHostDownCapture}
        onPointerMove={onHostHover}
        onPointerDown={() => {
          setMenu(null);
          if (tool === 'cursor') setSelected(null);
        }}
      >
        <div ref={hostRef} className="chart-canvas" />
        <div className="chart-overlay">
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
              const hide = y == null || y < -10 || y > paneH + 10;
              return (
                <div
                  key={l.key}
                  className={`oline ${l.cls}`}
                  style={{ transform: `translateY(${y ?? 0}px)`, visibility: hide ? 'hidden' : undefined, right: scaleW }}
                  ref={(el) => {
                    if (el) tagEls.current.set(l.key, { el, price: l.price });
                    else tagEls.current.delete(l.key);
                  }}
                >
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

