import type { ChartController } from './chartController';
import type { Drawing } from './types';
import type { Shape } from './drawingScene';
import type { SetupMark } from './parcaSetup';
import type { ParcaId } from './parcaVariants';
import { isGoldId, parcaName } from './parcaVariants';
import { C } from './theme';

export type LiveSetup = { id: ParcaId; side: 'long' | 'short'; entry: number; stop: number; target: number; strong: boolean; t: number; rr: number; liqR?: number };
/** Everything the canvas overlay paints, refreshed on every React render. */
export interface OverlayState {
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
export function setupShapes(ctrl: ChartController, s: OverlayState, W: number, H: number): Shape[] {
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
