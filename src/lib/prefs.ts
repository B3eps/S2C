import { uid } from './types';
import type { TF } from './types';
import type { ActiveInd } from './indicators';
import { GOLD_A_SETUP_DEFAULTS, GOLD_SETUP_DEFAULTS, PARCA_CLASSIC_ID, PARCA_GOLD_A_ID, PARCA_GOLD_ID } from './parcaVariants';

/** Chart and replay preferences (kv 'prefs'): pane layout, timeframes, indicators, pane looks. */
export interface ChartPrefs {
  parcaSetupInitialized?: boolean;
  parcaGoldInitialized?: boolean;
  parcaGoldTuned?: boolean;
  parcaGoldAInitialized?: boolean;
  /** how many chart panes are shown (1, 2, 3, 4, 6, 8) */
  count: number;
  panes: PaneCfg[];
  speed: number;
  speedScaleVersion?: 2;
  /** drawings snap to candle time and OHLC (hold Alt to place freely) */
  magnet?: boolean;
  /** bottom dock: height in px, and whether it is folded to its replay bar */
  dockH?: number;
  dockOpen?: boolean;
  /** how 2+ panes share the space: side by side, stacked, or one large pane beside the rest */
  arrange?: 'cols' | 'rows' | 'focus';
  /** the crosshair of one pane shows the same moment on the others */
  syncCrosshair?: boolean;
  /** right order panel */
  orderOpen?: boolean;
  orderW?: number;
}

export interface PaneView {
  /** rising candles drawn as outlines */
  hollow?: boolean;
  /** Asia / London / New York background bands (default on) */
  bands?: boolean;
  /** grid lines (default on) */
  grid?: boolean;
  /** logarithmic price scale */
  log?: boolean;
  /** keep the newest candle in view as the replay advances (default on) */
  follow?: boolean;
}

export const SPEEDS = [0.5, 1, 2, 4, 8, 16, 32];
export const LAYOUTS = [1, 2, 3, 4, 6, 8];

export interface PaneCfg {
  tf: TF;
  ind: ActiveInd[];
  /** look of this pane; every field defaults to the app's standard */
  view?: PaneView;
}
const PANE_TFS: TF[] = ['5m', '1h', '15m', '4h', '1m', '5m', '15m', '1h'];
const parcaIndicator = (): ActiveInd => ({ uid: uid(), id: PARCA_CLASSIC_ID, params: { pivot: 2, window: 10, zoneAge: 80 }, colors: ['#c9a96e'] });
const parcaGoldIndicator = (): ActiveInd => ({ uid: uid(), id: PARCA_GOLD_ID, params: { ...GOLD_SETUP_DEFAULTS }, colors: ['#e8c46e'] });
const parcaGoldAIndicator = (): ActiveInd => ({ uid: uid(), id: PARCA_GOLD_A_ID, params: { ...GOLD_A_SETUP_DEFAULTS }, colors: ['#f2d58a'] });
const defaultPanes = (): PaneCfg[] => PANE_TFS.map((tf, i) => ({ tf, ind: i === 0 ? [parcaIndicator(), parcaGoldIndicator(), parcaGoldAIndicator()] : [] }));
/** The first pane drives replay steps and trade records. */
export const mainTf = (p: ChartPrefs) => p.panes[0].tf;

export const DEFAULT_PREFS: ChartPrefs = {
  parcaSetupInitialized: true,
  parcaGoldInitialized: true,
  parcaGoldTuned: true,
  parcaGoldAInitialized: true,
  count: 1,
  panes: defaultPanes(),
  speed: 1,
  speedScaleVersion: 2,
  magnet: true,
  dockH: 232,
  dockOpen: true,
  orderOpen: true,
};

export function migratePrefs(raw: unknown): ChartPrefs {
  const p = (raw ?? {}) as Partial<ChartPrefs> & { layout?: string; tfA?: TF; tfB?: TF; indA?: ActiveInd[]; indB?: ActiveInd[] };
  const speed = p.speedScaleVersion === 2 ? p.speed ?? 1 : p.speed === undefined ? 1 : Math.min(SPEEDS.length - 1, p.speed + 1);
  if (p.panes && p.panes.length === 8) {
    const panes = p.panes.map((pane, i) => {
      const ind = pane.ind.map((item) => {
        const v = item.params;
        // Gold settings saved before the engulf entry existed: move to the current preset.
        if (item.id === PARCA_GOLD_ID && (v.entry === undefined || v.ema === undefined || v.adx === undefined || v.minP === undefined || v.room === undefined)) return { ...item, params: { ...GOLD_SETUP_DEFAULTS } };
        if (!p.parcaGoldTuned && item.id === PARCA_GOLD_ID && v.pivot === 3 && v.window === 6 &&
          v.zoneAge === 60 && v.minGap === 0.45 && v.biasMode === 2 && v.sweep === 1 && v.session === 1)
          return { ...item, params: { ...v, sweep: 2 } };
        // Migrate only the previous untouched preset; keep deliberate user settings.
        if (item.id !== 'parca-setup' || v.pivot !== 2 || v.window !== 8 || v.zoneAge !== 80 ||
          (v.minGap !== undefined && v.minGap !== 0.3) ||
          (v.biasMode !== undefined && v.biasMode !== 2) ||
          (v.sweep !== undefined && v.sweep !== 0) ||
          (v.session !== undefined && v.session !== 1)) return item;
        return { ...item, params: { ...v, window: 10, minGap: 0.25 } };
      });
      if (i === 0 && !p.parcaSetupInitialized && !ind.some((item) => item.id === PARCA_CLASSIC_ID)) ind.push(parcaIndicator());
      if (i === 0 && !p.parcaGoldInitialized && !p.panes!.some((other) => other.ind.some((item) => item.id === PARCA_GOLD_ID))) ind.push(parcaGoldIndicator());
      if (i === 0) for (let k = 0; k < ind.length; k++) if (ind[k].id === PARCA_GOLD_A_ID && (ind[k].params.minP === undefined || ind[k].params.room === undefined)) ind[k] = { ...ind[k], params: { ...GOLD_A_SETUP_DEFAULTS } };
      if (i === 0 && !p.parcaGoldAInitialized && !p.panes!.some((other) => other.ind.some((item) => item.id === PARCA_GOLD_A_ID))) ind.push(parcaGoldAIndicator());
      return { ...pane, ind };
    });
    return { ...DEFAULT_PREFS, ...p, panes, speed: panes[0].tf === '1m' ? Math.min(speed, 3) : speed,
      speedScaleVersion: 2, parcaSetupInitialized: true, parcaGoldInitialized: true, parcaGoldTuned: true, parcaGoldAInitialized: true };
  }
  const panes = defaultPanes();
  if (p.tfA) panes[0] = { tf: p.tfA, ind: [...(p.indA ?? []), parcaIndicator(), parcaGoldIndicator()] };
  if (p.tfB) panes[1] = { tf: p.tfB, ind: p.indB ?? [] };
  return { ...DEFAULT_PREFS, count: p.layout === 'dual' ? 2 : 1, panes, speed: panes[0].tf === '1m' ? Math.min(speed, 3) : speed,
    speedScaleVersion: 2,
    parcaSetupInitialized: true, parcaGoldInitialized: true, parcaGoldTuned: true, parcaGoldAInitialized: true };
}
