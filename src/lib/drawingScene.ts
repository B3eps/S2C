import type { Bar, Drawing } from './types';
import { FIB_LEVELS, regression, defaultStop } from './drawings';
import { C, alpha } from './theme';

/**
 * Drawings as plain shapes in pane pixels. The same shapes are painted on the chart canvas
 * (overlayPrimitive.ts) and hit-tested for selection and dragging, so what you see is exactly
 * what you can grab, and both move in the same frame as the candles.
 */
export type Shape =
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number; dash?: boolean; hit?: boolean }
  | { k: 'poly'; pts: number[]; fill: string; stroke?: string; hit?: boolean }
  | { k: 'box'; x: number; y: number; w: number; h: number; fill: string; stroke?: string; sw?: number; r?: number }
  | { k: 'text'; x: number; y: number; text: string; color: string; size: number; weight: number; align: CanvasTextAlign; halo?: boolean; hit?: boolean }
  | { k: 'dot'; x: number; y: number; r: number; color: string }
  | { k: 'handle'; x: number; y: number; which: Handle };

export type Handle = 'a' | 'b' | 'c';

export interface SceneEnv {
  /** time (ms) → pane x, or null when it cannot be mapped */
  X: (t: number) => number | null;
  /** price → pane y */
  Y: (p: number) => number | null;
  /** pane width and height in px */
  W: number;
  H: number;
  bars: Bar[];
  tfMs: number;
}

const INK2 = C.ink2;
const INK1 = C.ink1;
const FILL = alpha('#a9a397', 0.07);
const WIN = { fill: alpha(C.up, 0.16), stroke: alpha(C.up, 0.5) };
const LOSS = { fill: alpha(C.down, 0.16), stroke: alpha(C.down, 0.5) };

const pct = (from: number, to: number) => {
  const v = ((to - from) / from) * 100;
  return `${v >= 0 ? '+' : '−'}%${Math.abs(v).toFixed(2).replace('.', ',')}`;
};
const rectPts = (x1: number, y1: number, x2: number, y2: number) => [x1, y1, x2, y1, x2, y2, x1, y2];

/** Shapes for one drawing; `sel` adds handles and brightens the stroke. */
export function drawingShapes(d: Drawing, env: SceneEnv, sel: boolean): Shape[] {
  const { X, Y, W, H } = env;
  const ax = X(d.a.t), ay = Y(d.a.p), bx = X(d.b.t), by = Y(d.b.p);
  if (ax == null || ay == null || bx == null || by == null) return [];
  const color = d.color ?? (sel ? INK1 : INK2);
  const width = (d.width ?? 1) * 1.25;
  const out: Shape[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, o: { dash?: boolean; strong?: boolean; hit?: boolean } = {}) =>
    out.push({ k: 'line', x1, y1, x2, y2, color: o.strong && !d.color ? INK1 : color, width, dash: o.dash, hit: o.hit ?? true });
  const handle = (which: Handle, x: number, y: number) => sel && out.push({ k: 'handle', x, y, which });
  const label = (x: number, y: number, text: string, tone = INK2, align: CanvasTextAlign = 'left') =>
    out.push({ k: 'text', x, y, text, color: tone, size: 11, weight: 600, align, halo: true });
  /** a line through two points, cut at the pane edges */
  const ext = (x1: number, y1: number, x2: number, y2: number, mode: 'both' | 'dir') => {
    const dx = x2 - x1;
    if (Math.abs(dx) < 1e-6) return [x1, 0, x1, H] as const;
    const k = (y2 - y1) / dx;
    const at = (x: number) => y1 + k * (x - x1);
    if (mode === 'both') return [0, at(0), W, at(W)] as const;
    const edge = dx > 0 ? W : 0;
    return [x1, y1, edge, at(edge)] as const;
  };

  switch (d.kind) {
    case 'trend':
      line(ax, ay, bx, by);
      handle('a', ax, ay); handle('b', bx, by);
      break;
    case 'arrow': {
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const ux = (bx - ax) / len, uy = (by - ay) / len;
      const hs = 9 + (d.width ?? 1) * 1.5;
      line(ax, ay, bx - ux * 2, by - uy * 2);
      out.push({ k: 'poly', pts: [bx, by, bx - ux * hs - uy * hs * 0.5, by - uy * hs + ux * hs * 0.5, bx - ux * hs + uy * hs * 0.5, by - uy * hs - ux * hs * 0.5], fill: color });
      handle('a', ax, ay); handle('b', bx, by);
      break;
    }
    case 'ray': line(...ext(ax, ay, bx, by, 'dir')); handle('a', ax, ay); handle('b', bx, by); break;
    case 'extended': line(...ext(ax, ay, bx, by, 'both')); handle('a', ax, ay); handle('b', bx, by); break;
    case 'text':
      out.push({ k: 'dot', x: ax, y: ay, r: 3, color: d.color ?? INK2 });
      out.push({ k: 'text', x: ax + 6, y: ay - 6, text: d.text || 'Not', color: d.color ?? INK1, size: 13, weight: 600, align: 'left', halo: true, hit: true });
      handle('a', ax, ay);
      break;
    case 'hline': line(0, ay, W, ay); handle('a', Math.min(Math.max(ax, 8), W - 8), ay); break;
    case 'hray': line(ax, ay, W, ay); handle('a', ax, ay); break;
    case 'vline': line(ax, 0, ax, H); handle('a', ax, ay); break;
    case 'cross': line(0, ay, W, ay); line(ax, 0, ax, H); handle('a', ax, ay); break;
    case 'rect':
      out.push({ k: 'poly', pts: rectPts(ax, ay, bx, by), fill: sel ? alpha(INK1, 0.06) : alpha('#a9a397', 0.06), stroke: color, hit: true });
      handle('a', ax, ay); handle('b', bx, by);
      break;
    case 'channel': {
      if (!d.c) { line(ax, ay, bx, by); break; }
      const cx = X(d.c.t) ?? bx, cy = Y(d.c.p) ?? by;
      const k = bx === ax ? 0 : (by - ay) / (bx - ax);
      const off = cy - (ay + k * (cx - ax));
      out.push({ k: 'poly', pts: [ax, ay, bx, by, bx, by + off, ax, ay + off], fill: FILL, hit: true });
      line(ax, ay, bx, by);
      line(ax, ay + off, bx, by + off);
      line(ax, ay + off / 2, bx, by + off / 2, { dash: true });
      handle('a', ax, ay); handle('b', bx, by); handle('c', cx, cy);
      break;
    }
    case 'regression': {
      const r = regression(env.bars, d.a.t, d.b.t);
      if (!r) { line(ax, ay, bx, by, { dash: true }); break; }
      const x1 = X(r.t1) ?? ax, x2 = X(r.t2) ?? bx;
      const yy = (t: number, s: number) => Y(r.at(t) + s * r.sd) ?? 0;
      out.push({ k: 'poly', pts: [x1, yy(r.t1, 2), x2, yy(r.t2, 2), x2, yy(r.t2, -2), x1, yy(r.t1, -2)], fill: FILL, hit: true });
      line(x1, yy(r.t1, 0), x2, yy(r.t2, 0));
      line(x1, yy(r.t1, 2), x2, yy(r.t2, 2), { dash: true });
      line(x1, yy(r.t1, -2), x2, yy(r.t2, -2), { dash: true });
      handle('a', x1, yy(r.t1, 0)); handle('b', x2, yy(r.t2, 0));
      break;
    }
    case 'pitchfork': {
      if (!d.c) { line(ax, ay, bx, by, { dash: true }); break; }
      const cx = X(d.c.t) ?? bx, cy = Y(d.c.p) ?? by;
      const mx = (bx + cx) / 2, my = (by + cy) / 2;
      const k = mx === ax ? 0 : (my - ay) / (mx - ax);
      const edge = mx >= ax ? W : 0;
      line(...ext(ax, ay, mx, my, 'dir'));
      line(bx, by, edge, by + k * (edge - bx));
      line(cx, cy, edge, cy + k * (edge - cx));
      line(bx, by, cx, cy, { dash: true });
      handle('a', ax, ay); handle('b', bx, by); handle('c', cx, cy);
      break;
    }
    case 'fib': {
      const x1 = Math.min(ax, bx);
      const lv = FIB_LEVELS.map((L) => ({ L, y: Y(d.b.p + (d.a.p - d.b.p) * L) ?? 0 }));
      lv.slice(1).forEach((l, i) => out.push({ k: 'poly', pts: rectPts(x1, lv[i].y, W, l.y), fill: alpha('#a9a397', i % 2 ? 0.1 : 0.05), hit: true }));
      for (const l of lv) {
        line(x1, l.y, W, l.y, { strong: l.L === 0.5 || l.L === 0.618 });
        label(x1 + 4, l.y - 4, l.L.toFixed(3).replace('.', ','));
      }
      line(ax, ay, bx, by, { dash: true });
      handle('a', ax, ay); handle('b', bx, by);
      break;
    }
    case 'longpos':
    case 'shortpos': {
      const stop = d.c?.p ?? defaultStop(d.a.p, d.b.p);
      const sy = Y(stop) ?? ay;
      const x1 = Math.min(ax, bx);
      const x2 = Math.max(Math.max(ax, bx), x1 + 120);
      const rr = Math.abs(d.b.p - d.a.p) / Math.max(1e-9, Math.abs(stop - d.a.p));
      out.push({ k: 'poly', pts: rectPts(x1, ay, x2, by), ...WIN, hit: true });
      out.push({ k: 'poly', pts: rectPts(x1, ay, x2, sy), ...LOSS, hit: true });
      out.push({ k: 'line', x1, y1: ay, x2, y2: ay, color: INK2, width: 1.25 });
      label(x1 + 6, by + (by < ay ? 14 : -6), `Hedef ${pct(d.a.p, d.b.p)}`, C.up);
      label(x1 + 6, sy + (sy > ay ? -6 : 14), `Stop ${pct(d.a.p, stop)}`, C.down);
      label(x1 + 6, ay + (by < ay ? 14 : -6), `R:R 1 : ${rr.toFixed(2).replace('.', ',')}`);
      handle('a', x1, ay); handle('b', x2, by); handle('c', x2, sy);
      break;
    }
    case 'measure': {
      const up = d.b.p >= d.a.p;
      const n = Math.round(Math.abs(d.b.t - d.a.t) / env.tfMs);
      out.push({ k: 'poly', pts: rectPts(ax, ay, bx, by), ...(up ? WIN : LOSS), hit: true });
      out.push({ k: 'line', x1: ax, y1: ay, x2: bx, y2: by, color: INK2, width: 1.25, dash: true });
      label((ax + bx) / 2, Math.min(ay, by) - 6, `${pct(d.a.p, d.b.p)} · ${n} mum`, up ? C.up : C.down, 'center');
      handle('a', ax, ay); handle('b', bx, by);
      break;
    }
  }
  return out;
}

// ── hit testing ──────────────────────────────────────────────────────────────
const segDist = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};
const inPoly = (x: number, y: number, p: number[]) => {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
};

/** What a pointer at (x, y) grabs: a handle first, then the drawing body. */
export function hitShapes(shapes: Shape[], x: number, y: number): 'body' | Handle | null {
  for (const s of shapes) if (s.k === 'handle' && Math.abs(s.x - x) <= 6 && Math.abs(s.y - y) <= 6) return s.which;
  for (const s of shapes) {
    if (s.k === 'line' && s.hit && segDist(x, y, s.x1, s.y1, s.x2, s.y2) <= 5) return 'body';
    if (s.k === 'poly' && s.hit && inPoly(x, y, s.pts)) return 'body';
    if (s.k === 'text' && s.hit) {
      const w = s.text.length * s.size * 0.6;
      if (x >= s.x - 2 && x <= s.x + w && y >= s.y - s.size && y <= s.y + 4) return 'body';
    }
  }
  return null;
}

// ── painting ─────────────────────────────────────────────────────────────────
const FONT = "'Archivo Variable', system-ui, sans-serif";

export function paintShapes(ctx: CanvasRenderingContext2D, shapes: Shape[]) {
  for (const s of shapes) {
    switch (s.k) {
      case 'poly': {
        ctx.beginPath();
        ctx.moveTo(s.pts[0], s.pts[1]);
        for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i], s.pts[i + 1]);
        ctx.closePath();
        ctx.fillStyle = s.fill;
        ctx.fill();
        if (s.stroke) { ctx.strokeStyle = s.stroke; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.stroke(); }
        break;
      }
      case 'line':
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.setLineDash(s.dash ? [4, 4] : []);
        ctx.stroke();
        break;
      case 'box':
        ctx.beginPath();
        ctx.roundRect(s.x, s.y, s.w, s.h, s.r ?? 0);
        ctx.fillStyle = s.fill;
        ctx.fill();
        if (s.stroke) { ctx.strokeStyle = s.stroke; ctx.lineWidth = s.sw ?? 1; ctx.setLineDash([]); ctx.stroke(); }
        break;
      case 'dot':
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();
        break;
      case 'text':
        ctx.font = `${s.weight} ${s.size}px ${FONT}`;
        ctx.textAlign = s.align;
        ctx.textBaseline = 'alphabetic';
        if (s.halo) { ctx.strokeStyle = C.ply0; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.setLineDash([]); ctx.strokeText(s.text, s.x, s.y); }
        ctx.fillStyle = s.color;
        ctx.fillText(s.text, s.x, s.y);
        break;
      case 'handle':
        ctx.beginPath();
        ctx.rect(s.x - 4, s.y - 4, 8, 8);
        ctx.fillStyle = C.ply0;
        ctx.fill();
        ctx.strokeStyle = C.ink1;
        ctx.lineWidth = 1.25;
        ctx.setLineDash([]);
        ctx.stroke();
        break;
    }
  }
  ctx.setLineDash([]);
}
