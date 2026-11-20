import { useEffect, useRef, useState } from 'react';
import type { SeriesMarker, Time, Logical } from 'lightweight-charts';
import { ChartController } from '../lib/chartController';
import { fetchRange } from '../lib/feed';
import { instrumentOf } from '../lib/instruments';
import { Bar, TF_MS, Trade } from '../lib/types';
import { C } from '../lib/theme';

/**
 * A crisp, trade-focused chart drawn from the trade's own candles: entry, stop and target as
 * lines, entry and exit as labelled markers, framed tightly around the trade.
 */
export function TradeChart({ trade, revealed, until }: { trade: Trade; revealed: boolean; until?: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [bars, setBars] = useState<Bar[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    setBars(null);
    setErr(false);
    const ms = TF_MS[trade.tf];
    const from = trade.openedAt - 60 * ms;
    let to = trade.closedAt + 20 * ms;
    if (until) to = Math.min(to, until);
    fetchRange(trade.tf, from, to, instrumentOf(trade).id)
      .then((b) => alive && setBars(b))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [trade.id, until]);

  useEffect(() => {
    if (!bars || !hostRef.current || !bars.length) return;
    const ctrl = new ChartController(hostRef.current, trade.tf);
    ctrl.setPriceMode(revealed, trade.entry);
    ctrl.reset(bars, trade.tf);
    const ms = TF_MS[trade.tf];
    const stop = trade.initialSl ?? trade.sl;
    ctrl.syncLines([
      { key: 'e', price: trade.entry, color: trade.side === 'long' ? C.up : C.down, dashed: false },
      ...(stop !== undefined ? [{ key: 'sl', price: stop, color: C.down, dashed: true }] : []),
      ...(trade.tp !== undefined ? [{ key: 'tp', price: trade.tp, color: C.up, dashed: true }] : []),
      { key: 'x', price: trade.exit, color: C.ink2, dashed: true },
    ]);
    const m: SeriesMarker<Time>[] = [
      {
        time: ctrl.bucket(trade.openedAt),
        position: trade.side === 'long' ? 'belowBar' : 'aboveBar',
        shape: trade.side === 'long' ? 'arrowUp' : 'arrowDown',
        color: trade.side === 'long' ? C.up : C.down,
        text: 'Giriş',
        size: 1.4,
      },
      {
        time: ctrl.bucket(trade.closedAt - 60_000),
        position: trade.side === 'long' ? 'aboveBar' : 'belowBar',
        shape: 'circle',
        color: trade.reason === 'tp' ? C.gold : trade.reason === 'sl' ? C.down : C.ink2,
        text: 'Çıkış',
        size: 1.2,
      },
    ];
    ctrl.setMarkers(m);
    const i0 = bars.findIndex((b) => b.t + ms > trade.openedAt);
    ctrl.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, i0 - 30), to: bars.length + 2 } as { from: Logical; to: Logical });
    return () => ctrl.destroy();
  }, [bars, revealed, trade]);

  return (
    <div className="trade-chart">
      {err ? <div className="empty">Grafik verisi alınamadı.</div> : !bars ? <div className="empty"><span className="spin" /></div> : <div ref={hostRef} className="trade-chart-host" />}
    </div>
  );
}
