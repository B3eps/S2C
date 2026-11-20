import { useEffect, useRef, useState } from 'react';
import { useApp, LAYOUTS } from '../store';
import { CATS, TOOLS, TOOL_BY_KIND, ToolCat, ToolDef } from '../lib/drawings';
import type { DrawingKind } from '../lib/types';
import { Icon, IconName } from './Icon';
import { AnimatePresence, m } from 'motion/react';
import { flyout } from '../lib/motion';

const ICON: Record<DrawingKind, IconName> = {
  trend: 'trend',
  arrow: 'arrow',
  ray: 'ray',
  extended: 'extended',
  hline: 'hline',
  hray: 'hray',
  vline: 'vline',
  cross: 'crossline',
  channel: 'channel',
  regression: 'regression',
  pitchfork: 'pitchfork',
  fib: 'fib',
  rect: 'rect',
  longpos: 'longpos',
  shortpos: 'shortpos',
  measure: 'measure',
  text: 'text',
};

/** Grid shape per pane count: [columns, rows]. */
export const GRID: Record<number, [number, number]> = { 1: [1, 1], 2: [2, 1], 3: [3, 1], 4: [2, 2], 6: [3, 2], 8: [4, 2] };

export type Arrange = 'cols' | 'rows' | 'focus';
const fr = (n: number) => `repeat(${n}, minmax(0, 1fr))`;
/**
 * Grid tracks for the chart panes. cols: side by side; rows: stacked; focus: the first pane
 * large on the left, the others in one or two columns beside it.
 */
export function paneGrid(count: number, arrange: Arrange = 'cols'): { cols: string; rows: string; focus: boolean } {
  if (count <= 1) return { cols: fr(1), rows: fr(1), focus: false };
  if (arrange === 'focus') {
    const side = count - 1 > 3 ? 2 : 1;
    return { cols: `minmax(0, 2fr) ${fr(side)}`, rows: fr(Math.ceil((count - 1) / side)), focus: true };
  }
  const [c, r] = GRID[count] ?? [1, 1];
  return arrange === 'rows' ? { cols: fr(r), rows: fr(c), focus: false } : { cols: fr(c), rows: fr(r), focus: false };
}

const ARRANGE: { id: Arrange; name: string; hint: string }[] = [
  { id: 'cols', name: 'Yan yana', hint: 'Grafikler soldan sağa dizilir' },
  { id: 'rows', name: 'Üst üste', hint: 'Grafikler yukarıdan aşağı dizilir; uzun zaman çizgisi için' },
  { id: 'focus', name: 'Odak', hint: 'İlk grafik büyük, diğerleri yanında küçük' },
];

/** a tiny picture of a pane arrangement */
function Mini({ count, arrange }: { count: number; arrange: Arrange }) {
  const g = paneGrid(count, arrange);
  return (
    <span className="mini" style={{ gridTemplateColumns: g.cols, gridTemplateRows: g.rows }}>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} style={g.focus && i === 0 ? { gridRow: '1 / -1' } : undefined} />
      ))}
    </span>
  );
}

type Open = { what: ToolCat | 'layout'; top: number } | null;

export function ToolRail() {
  const tool = useApp((s) => s.tool);
  const prefs = useApp((s) => s.prefs);
  const showPrice = useApp((s) => s.showPrice);
  const settings = useApp((s) => s.settings);
  const n = useApp((s) => s.session?.drawings.length ?? 0);
  const S = useApp.getState;
  const [open, setOpen] = useState<Open>(null);
  const [tip, setTip] = useState<{ def: ToolDef; top: number } | null>(null);
  const [last, setLast] = useState<Record<ToolCat, DrawingKind>>(() => Object.fromEntries(CATS.map((c) => [c.id, TOOLS.find((t) => t.cat === c.id)!.kind])) as Record<ToolCat, DrawingKind>);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(null);
        setTip(null);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null);
        setTip(null);
      }
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const toggle = (what: ToolCat | 'layout') => (e: React.MouseEvent) => {
    const top = (e.currentTarget as HTMLElement).getBoundingClientRect().top;
    setTip(null);
    setOpen(open?.what === what ? null : { what, top });
  };
  const pick = (def: ToolDef) => {
    S().setTool(def.kind);
    setLast({ ...last, [def.cat]: def.kind });
    setOpen(null);
    setTip(null);
  };
  const activeCat = tool !== 'cursor' ? TOOL_BY_KIND[tool]?.cat : null;

  return (
    <div className="tools" ref={ref}>
      <button className="icon-btn" aria-pressed={tool === 'cursor'} title="İmleç" onClick={() => S().setTool('cursor')}>
        <Icon name="cursor" />
      </button>
      {CATS.map((c) => (
        <button
          key={c.id}
          className="icon-btn has-menu"
          aria-pressed={activeCat === c.id}
          aria-expanded={open?.what === c.id}
          title={c.name}
          onClick={toggle(c.id)}
        >
          <Icon name={ICON[activeCat === c.id && tool !== 'cursor' ? tool : last[c.id]]} />
        </button>
      ))}
      <button
        className="icon-btn"
        aria-pressed={prefs.magnet !== false}
        title={prefs.magnet !== false ? 'Mıknatıs açık: çizim mumun O/H/L/C noktasına yapışır (Alt = serbest)' : 'Mıknatıs kapalı'}
        onClick={() => S().setPrefs({ magnet: prefs.magnet === false })}
      >
        <Icon name="magnet" />
      </button>
      <button className="icon-btn" title="Tüm çizimleri sil" disabled={!n} onClick={() => S().clearDrawings()} style={{ opacity: n ? 1 : 0.4 }}>
        <Icon name="trash" />
      </button>
      <hr />
      <button className="icon-btn has-menu" title="Grafik bölmeleri" aria-expanded={open?.what === 'layout'} onClick={toggle('layout')}>
        <Icon name="grid" />
      </button>
      <button className="icon-btn" aria-pressed={showPrice} title={showPrice ? 'Fiyatı gizle' : 'Fiyatı göster'} onClick={() => S().setShowPrice(!showPrice)}>
        <Icon name={showPrice ? 'eye' : 'eyeOff'} />
      </button>
      <hr />
      <button className="icon-btn" title={settings.sound ? 'Sesi kapat' : 'Sesi aç'} onClick={() => S().saveSettings({ sound: !settings.sound })}>
        <Icon name={settings.sound ? 'soundOn' : 'soundOff'} />
      </button>

      <AnimatePresence>
      {open && open.what !== 'layout' && (
        <m.div key={open.what} className="flyout" style={{ top: Math.min(open.top, window.innerHeight - 320) }} {...flyout}>
          <div className="flyout-title">{CATS.find((c) => c.id === open.what)?.name}</div>
          {TOOLS.filter((t) => t.cat === open.what).map((t) => (
            <button
              key={t.kind}
              className="flyout-item"
              aria-pressed={tool === t.kind}
              onClick={() => pick(t)}
              onMouseEnter={(e) => (t.desc ? setTip({ def: t, top: (e.currentTarget as HTMLElement).getBoundingClientRect().top }) : setTip(null))}
            >
              <Icon name={ICON[t.kind]} size={18} />
              <span>{t.name}</span>
              {t.desc && <Icon name="info" size={14} className="flyout-info" />}
            </button>
          ))}
        </m.div>
      )}
      </AnimatePresence>
      {open && open.what !== 'layout' && tip && (
        <div className="tool-tip" style={{ top: Math.min(tip.top, window.innerHeight - 200) }} onMouseLeave={() => setTip(null)}>
          <div className="tool-tip-head">
            <Icon name={ICON[tip.def.kind]} size={16} />
            {tip.def.name}
          </div>
          <p>{tip.def.desc}</p>
          {tip.def.link && (
            <a href={tip.def.link} target="_blank" rel="noreferrer">
              Daha fazla bilgi
            </a>
          )}
        </div>
      )}
      <AnimatePresence>
      {open?.what === 'layout' && (
        <m.div key="layout" className="flyout layout-pick" style={{ top: Math.min(open.top, window.innerHeight - 360) }} {...flyout}>
          <div className="flyout-title">Grafik bölmeleri</div>
          <div className="layout-grid">
            {LAYOUTS.map((k) => {
              return (
                <button
                  key={k}
                  className="layout-opt"
                  aria-pressed={prefs.count === k}
                  title={`${k} grafik`}
                  onClick={() => S().setPrefs({ count: k })}
                >
                  <Mini count={k} arrange={prefs.arrange ?? 'cols'} />
                  {k}
                </button>
              );
            })}
          </div>
          <div className="flyout-title">Yerleşim</div>
          <div className="arrange-row" role="group" aria-label="Yerleşim">
            {ARRANGE.map((a) => (
              <button
                key={a.id}
                className="layout-opt"
                aria-pressed={(prefs.arrange ?? 'cols') === a.id}
                disabled={prefs.count < 2}
                title={a.hint}
                onClick={() => S().setPrefs({ arrange: a.id })}
              >
                <Mini count={Math.max(3, Math.min(prefs.count, 4))} arrange={a.id} />
                {a.name}
              </button>
            ))}
          </div>
          <hr />
          <button
            className="flyout-item"
            role="menuitemcheckbox"
            aria-checked={prefs.syncCrosshair !== false}
            title="Bir grafikte imleci gezdirince diğerleri aynı anı gösterir"
            onClick={() => S().setPrefs({ syncCrosshair: prefs.syncCrosshair === false })}
          >
            <span className="tick">{prefs.syncCrosshair !== false && <Icon name="check" size={14} />}</span>
            <span>İmleçleri eşitle</span>
          </button>
        </m.div>
      )}
      </AnimatePresence>
    </div>
  );
}
