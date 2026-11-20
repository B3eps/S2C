import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { ChartController } from '../lib/chartController';
import { fetchRange } from '../lib/feed';
import { instrumentOf } from '../lib/instruments';
import { Bar, TF_MS, TF_LABEL } from '../lib/types';
import { C } from '../lib/theme';
import { Icon } from '../components/Icon';
import { REASON } from './Trade';
import { rMult, signedMoney, lots as fmtLots } from '../lib/format';

export function Replay() {
  const id = useApp((s) => s.replayTradeId);
  const trade = useApp((s) => s.trades.find((t) => t.id === id));
  const session = useApp((s) => s.sessions.find((x) => x.id === trade?.sessionId));
  const S = useApp.getState;
  const hostRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<ChartController | null>(null);
  const [bars, setBars] = useState<Bar[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const startIdx = useRef(0);

  useEffect(() => {
    if (!trade) return;
    const ms = TF_MS[trade.tf];
    const from = trade.openedAt - 90 * ms;
    let to = trade.closedAt + 25 * ms;
    // never show beyond what the trader has already seen in a running session
    if (session && !session.endedAt) to = Math.min(to, session.clockMs);
    fetchRange(trade.tf, from, to, instrumentOf(trade).id)
      .then((b) => {
        setBars(b);
        const s = Math.max(1, b.findIndex((x) => x.t + ms > trade.openedAt));
        startIdx.current = s;
        setIdx(s);
      })
      .catch(() => setErr('Veri alınamadı. Bağlantını kontrol et.'));
  }, [trade?.id]);

  useEffect(() => {
    if (!bars || !hostRef.current || !trade) return;
    const ctrl = new ChartController(hostRef.current, trade.tf);
    ctrlRef.current = ctrl;
    ctrl.setBandsVisible(true);
    ctrl.setPriceMode(!!session?.endedAt, trade.entry);
    return () => {
      ctrl.destroy();
      ctrlRef.current = null;
    };
  }, [bars, trade?.id]);

  useEffect(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl || !bars || !trade) return;
    const shown = bars.slice(0, idx + 1);
    if (idx === startIdx.current) {
      ctrl.reset(shown, trade.tf);
      ctrl.chart.timeScale().setVisibleLogicalRange({ from: 0, to: bars.length + 4 });
    }
    else ctrl.update(shown);
    const lastT = shown[shown.length - 1]?.t ?? 0;
    const ms = TF_MS[trade.tf];
    const open = lastT + ms > trade.openedAt;
    const closed = lastT + ms > trade.closedAt;
    const level = trade.levels?.filter(v => v.at <= lastT + ms).at(-1);
    const sl = level ? level.sl : trade.initialSl ?? trade.sl;
    const tp = level ? level.tp : trade.tp;
    ctrl.syncLines(
      open && !closed
        ? [
            { key: 'e', price: trade.entry, color: trade.side === 'long' ? C.up : C.down, dashed: false },
            ...(sl !== undefined ? [{ key: 'sl', price: sl, color: C.down, dashed: true }] : []),
            ...(tp !== undefined ? [{ key: 'tp', price: tp, color: C.up, dashed: true }] : []),
          ]
        : [],
    );
    const m = [];
    if (open) m.push({ time: ctrl.bucket(trade.openedAt), position: trade.side === 'long' ? ('belowBar' as const) : ('aboveBar' as const), shape: trade.side === 'long' ? ('arrowUp' as const) : ('arrowDown' as const), color: trade.side === 'long' ? C.up : C.down, text: 'Giriş' });
    if (closed) m.push({ time: ctrl.bucket(trade.closedAt - 60_000), position: 'aboveBar' as const, shape: 'circle' as const, color: trade.reason === 'tp' ? C.gold : trade.reason === 'sl' ? C.down : C.ink2, text: 'Çıkış' });
    ctrl.setMarkers(m);
  }, [idx, bars, trade]);

  useEffect(() => {
    if (!playing || !bars) return;
    const t = setInterval(() => {
      setIdx((i) => {
        if (i >= bars.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 160);
    return () => clearInterval(t);
  }, [playing, bars]);

  if (!trade)
    return (
      <div className="loading">
        <div className="inner">
          <p>İşlem bulunamadı.</p>
          <button className="btn" onClick={() => S().go('journal')}>
            Günlüğe dön
          </button>
        </div>
      </div>
    );

  return (
    <div className="replay">
      <div className="topbar">
        <button className="icon-btn" title="Günlüğe dön" onClick={() => S().openJournal(trade.id)}>
          <Icon name="chevron" style={{ transform: 'rotate(90deg)' }} />
        </button>
        <h1 style={{ fontSize: 'var(--t-16)' }}>
          İşlem tekrarı · <span className={trade.side === 'long' ? 'up' : 'down'}>{trade.side === 'long' ? 'Long' : 'Short'}</span> {fmtLots(trade.lots)} lot
        </h1>
        <span className="muted">
          {TF_LABEL[trade.tf]} · {REASON[trade.reason]} · <span className={trade.pnl > 0 ? 'up' : trade.pnl < 0 ? 'down' : ''}>{signedMoney(trade.pnl)}</span> · {rMult(trade.r)}
        </span>
      </div>
      <div className="chart-host">
        {err ? <div className="empty">{err}</div> : !bars ? <div className="loading"><span className="spin" /></div> : <div ref={hostRef} className="chart-canvas" />}
      </div>
      <div className="replay-bar" style={{ borderBottom: 0, background: 'var(--ply-1)' }}>
        <button className={`play ${playing ? 'on' : ''}`} onClick={() => setPlaying(!playing)} disabled={!bars} title={playing ? 'Duraklat' : 'Oynat'}>
          <Icon name={playing ? 'pause' : 'play'} size={16} />
        </button>
        <button className="btn sm" onClick={() => { setPlaying(false); setIdx(startIdx.current); }} disabled={!bars}>
          <Icon name="replay" size={14} /> Başa sar
        </button>
        <input
          type="range"
          min={startIdx.current}
          max={(bars?.length ?? 1) - 1}
          value={idx}
          onChange={(e) => {
            setPlaying(false);
            setIdx(parseInt(e.target.value));
          }}
          style={{ flex: 1, marginLeft: 12 }}
          aria-label="Konum"
        />
      </div>
    </div>
  );
}
