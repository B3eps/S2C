import {
  CandlestickSeries, CrosshairMode, HistogramSeries, IChartApi, IPriceLine, ISeriesApi, ISeriesMarkersPluginApi,
  LineSeries, LineStyle, Logical, SeriesMarker, Time, UTCTimestamp, createChart, createSeriesMarkers,
} from 'lightweight-charts';
import { C, SERIES, alpha } from './theme';
import { ActiveInd, IND_BY_ID, IndDef } from './indicators';
import { Bar, TF, TF_MS } from './types';
import { marketSession } from './calendar';
import { clockUtc } from './format';

const sec = (ms: number) => (ms / 1000) as UTCTimestamp;

const BAND: Record<string, string> = {
  asia: 'rgba(0,0,0,0)',
  london: alpha(C.gold, 0.035),
  overlap: alpha(C.gold, 0.06),
  ny: alpha('#8ea3a8', 0.045),
};

interface IndRuntime {
  ind: ActiveInd;
  def: IndDef;
  series: Record<string, ISeriesApi<'Line'> | ISeriesApi<'Histogram'>>;
  levels: IPriceLine[];
  last: Record<string, number>;
}

export interface LineSpec {
  key: string;
  price: number;
  color: string;
  dashed: boolean;
}

export class ChartController {
  chart: IChartApi;
  candles: ISeriesApi<'Candlestick'>;
  bands: ISeriesApi<'Histogram'>;
  markers: ISeriesMarkersPluginApi<Time>;
  bars: Bar[] = [];
  tf: TF;
  private inds: IndRuntime[] = [];
  private lines = new Map<string, IPriceLine>();
  private indRaf = 0;
  private showBands = true;

  constructor(host: HTMLElement, tf: TF) {
    this.tf = tf;
    this.chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { color: C.ply0 },
        textColor: C.ink3,
        fontFamily: "'Archivo Variable', system-ui, sans-serif",
        fontSize: 11,
        attributionLogo: false,
        panes: { separatorColor: C.rule, separatorHoverColor: alpha(C.gold, 0.3), enableResize: true },
      },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      rightPriceScale: { visible: true, borderColor: C.rule, minimumWidth: 64 },
      leftPriceScale: { visible: false },
      timeScale: {
        visible: true,
        borderColor: C.rule,
        rightOffset: 8,
        barSpacing: 7,
        minBarSpacing: 1.5,
        shiftVisibleRangeOnNewBar: true,
        // time of day only: the date stays hidden
        tickMarkFormatter: (t: number) => clockUtc(t * 1000),
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: alpha(C.ink2, 0.35), labelVisible: true, labelBackgroundColor: C.ply2, style: LineStyle.Dashed, width: 1 },
        horzLine: { color: alpha(C.ink2, 0.35), labelVisible: true, labelBackgroundColor: C.ply2, style: LineStyle.Dashed, width: 1 },
      },
      localization: { priceFormatter: (p: number) => this.formatPrice(p), timeFormatter: (t: number) => clockUtc(t * 1000) },
      handleScale: { axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: { time: true, price: true } },
    });
    this.bands = this.chart.addSeries(HistogramSeries, {
      priceScaleId: 'bands',
      lastValueVisible: false,
      priceLineVisible: false,
      base: 0,
    });
    this.chart.priceScale('bands').applyOptions({ scaleMargins: { top: 0, bottom: 0 }, visible: false });
    this.candles = this.chart.addSeries(CandlestickSeries, {
      upColor: C.up,
      downColor: C.down,
      borderUpColor: C.up,
      borderDownColor: C.down,
      wickUpColor: C.up,
      wickDownColor: C.down,
      lastValueVisible: false,
      priceLineVisible: true,
      priceLineColor: alpha(C.ink1, 0.45),
      priceLineStyle: LineStyle.Dotted,
      priceLineWidth: 1,
    });
    this.chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.08, bottom: 0.08 } });
    this.markers = createSeriesMarkers(this.candles, []);
  }

  /**
   * Hidden mode shows prices as an index: the session's first price is 1.000, every move keeps
   * its true proportion, the real level stays unknown.
   */
  private showReal = false;
  private anchor = 0;
  private nf = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  formatPrice(p: number) {
    if (this.showReal || !this.anchor) return this.showReal ? this.nf.format(p) : '';
    return this.nf.format((p / this.anchor) * 1000);
  }
  setPriceMode(showReal: boolean, anchor: number) {
    this.showReal = showReal;
    this.anchor = anchor;
    // nudge the scale so labels re-render with the new formatter
    this.chart.applyOptions({ localization: { priceFormatter: (p: number) => this.formatPrice(p) } });
  }
  priceScaleWidth() {
    return this.chart.priceScale('right').width();
  }
  timeScaleHeight() {
    return this.chart.timeScale().height();
  }

  destroy() {
    cancelAnimationFrame(this.indRaf);
    this.chart.remove();
  }

  setBandsVisible(v: boolean) {
    this.showBands = v;
    this.bands.applyOptions({ visible: v });
  }

  private bandData(bars: Bar[]) {
    return bars.map((b) => ({ time: sec(b.t), value: 1, color: BAND[marketSession(b.t).key] }));
  }

  reset(bars: Bar[], tf: TF) {
    this.tf = tf;
    this.bars = bars;
    this.candles.setData(bars.map((b) => ({ time: sec(b.t), open: b.o, high: b.h, low: b.l, close: b.c })));
    this.bands.setData(this.bandData(bars));
    this.recomputeIndicators();
    this.chart.timeScale().scrollToRealTime();
  }

  update(bars: Bar[]) {
    const prevLen = this.bars.length;
    if (bars.length < prevLen || !prevLen) return this.reset(bars, this.tf);
    this.bars = bars;
    for (let i = prevLen - 1; i < bars.length; i++) {
      const b = bars[i];
      this.candles.update({ time: sec(b.t), open: b.o, high: b.h, low: b.l, close: b.c });
      if (this.showBands) this.bands.update({ time: sec(b.t), value: 1, color: BAND[marketSession(b.t).key] });
    }
    this.scheduleIndicators();
  }

  // ── indicators ────────────────────────────────────────────────────────────
  setIndicators(list: ActiveInd[]) {
    for (const r of this.inds) {
      for (const s of Object.values(r.series)) this.chart.removeSeries(s);
    }
    this.inds = [];
    let pane = 1;
    for (const ind of list) {
      const def = IND_BY_ID[ind.id];
      if (!def) continue;
      const paneIndex = def.pane === 'overlay' ? 0 : pane++;
      const series: IndRuntime['series'] = {};
      def.outputs.forEach((o, i) => {
        const color = ind.colors[i] ?? SERIES[i % SERIES.length];
        const common = {
          lastValueVisible: false,
          priceLineVisible: false,
          visible: !ind.hidden,
          ...(def.pane === 'overlay' ? { priceScaleId: 'right' } : {}),
        };
        if (o.style === 'hist') {
          series[o.key] = this.chart.addSeries(HistogramSeries, { ...common, color }, paneIndex);
        } else {
          series[o.key] = this.chart.addSeries(
            LineSeries,
            {
              ...common,
              color,
              lineWidth: o.style === 'dots' ? 2 : 1,
              lineStyle: o.dashed ? LineStyle.Dashed : LineStyle.Solid,
              lineVisible: o.style !== 'dots',
              pointMarkersVisible: o.style === 'dots',
              pointMarkersRadius: 1.5,
              crosshairMarkerVisible: false,
            },
            paneIndex,
          );
        }
      });
      const levels: IPriceLine[] = [];
      const first = Object.values(series)[0];
      for (const lv of def.levels ?? []) {
        levels.push(first.createPriceLine({ price: lv, color: alpha(C.ink3, 0.5), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: '' }));
      }
      this.inds.push({ ind, def, series, levels, last: {} });
    }
    const panes = this.chart.panes();
    panes.forEach((p, i) => {
      if (i > 0) p.setHeight(104);
    });
    this.recomputeIndicators();
  }

  private scheduleIndicators() {
    if (this.indRaf) return;
    this.indRaf = requestAnimationFrame(() => {
      this.indRaf = 0;
      this.recomputeIndicators();
    });
  }

  private recomputeIndicators() {
    if (!this.bars.length) return;
    for (const r of this.inds) {
      const out = r.def.calc(this.bars, r.ind.params);
      r.def.outputs.forEach((o) => {
        const vals = out[o.key] ?? [];
        const s = r.series[o.key];
        const data = this.bars.map((b, i) => {
          const v = vals[i];
          if (v === undefined || Number.isNaN(v) || !Number.isFinite(v)) return { time: sec(b.t) };
          if (o.style === 'hist') {
            const color = o.updown ? alpha(b.c >= b.o ? C.up : C.down, 0.5) : o.signed ? alpha(v >= 0 ? C.up : C.down, 0.7) : undefined;
            return color ? { time: sec(b.t), value: v, color } : { time: sec(b.t), value: v };
          }
          return { time: sec(b.t), value: v };
        });
        s.setData(data);
        r.last[o.key] = vals[vals.length - 1];
      });
    }
    this.onIndicatorValues?.(Object.fromEntries(this.inds.map((r) => [r.ind.uid, r.last])));
  }

  onIndicatorValues?: (v: Record<string, Record<string, number>>) => void;

  // ── price lines mirrored on canvas (so screenshots carry them) ────────────
  syncLines(specs: LineSpec[]) {
    const seen = new Set<string>();
    for (const s of specs) {
      seen.add(s.key);
      const opts = { price: s.price, color: s.color, lineStyle: s.dashed ? LineStyle.Dashed : LineStyle.Solid, lineWidth: 1 as const, axisLabelVisible: false, title: '' };
      const ex = this.lines.get(s.key);
      if (ex) ex.applyOptions(opts);
      else this.lines.set(s.key, this.candles.createPriceLine(opts));
    }
    for (const [k, l] of this.lines) {
      if (!seen.has(k)) {
        this.candles.removePriceLine(l);
        this.lines.delete(k);
      }
    }
  }

  setMarkers(m: SeriesMarker<Time>[]) {
    this.markers.setMarkers(m.sort((a, b) => (a.time as number) - (b.time as number)));
  }

  bucket(ms: number) {
    const s = TF_MS[this.tf];
    return sec(Math.floor(ms / s) * s);
  }

  // ── coordinates ───────────────────────────────────────────────────────────
  private indexAt(t: number) {
    const b = this.bars;
    let lo = 0;
    let hi = b.length - 1;
    if (!b.length) return -1;
    if (t < b[0].t) return -1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (b[mid].t <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  timeToX(t: number): number | null {
    const b = this.bars;
    if (!b.length) return null;
    const ms = TF_MS[this.tf];
    const i = this.indexAt(t);
    let logical: number;
    if (i < 0) logical = (t - b[0].t) / ms;
    else if (i === b.length - 1) logical = i + (t - b[i].t) / ms;
    else logical = i + Math.min(0.999, (t - b[i].t) / ms);
    return this.chart.timeScale().logicalToCoordinate(logical as Logical);
  }

  xToTime(x: number): number | null {
    const b = this.bars;
    const l = this.chart.timeScale().coordinateToLogical(x);
    if (l === null || !b.length) return null;
    const ms = TF_MS[this.tf];
    const i = Math.floor(l);
    const frac = l - i;
    if (i < 0) return b[0].t + l * ms;
    if (i >= b.length) return b[b.length - 1].t + (l - (b.length - 1)) * ms;
    return b[i].t + frac * ms;
  }

  priceToY(p: number) {
    return this.candles.priceToCoordinate(p);
  }
  yToPrice(y: number) {
    return this.candles.coordinateToPrice(y);
  }
  lastBarX() {
    return this.chart.timeScale().logicalToCoordinate((this.bars.length - 1) as Logical);
  }
  mainPaneHeight() {
    return this.chart.panes()[0]?.getHeight() ?? 0;
  }

  /** A view signature: changes whenever anything that maps price/time to pixels changes. */
  signature() {
    const ts = this.chart.timeScale();
    const last = this.bars[this.bars.length - 1];
    const y1 = last ? this.priceToY(last.c) : 0;
    const y2 = last ? this.priceToY(last.c * 1.001) : 0;
    return `${ts.logicalToCoordinate(0 as Logical)}|${ts.options().barSpacing}|${y1}|${y2}|${this.mainPaneHeight()}|${this.bars.length}|${this.priceScaleWidth()}`;
  }

  screenshot(): string | null {
    try {
      const canvas = this.chart.takeScreenshot();
      const max = 1280;
      const scale = Math.min(1, max / canvas.width);
      const out = document.createElement('canvas');
      out.width = Math.round(canvas.width * scale);
      out.height = Math.round(canvas.height * scale);
      out.getContext('2d')!.drawImage(canvas, 0, 0, out.width, out.height);
      return out.toDataURL('image/webp', 0.82);
    } catch {
      return null;
    }
  }
}
