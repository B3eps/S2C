import { useEffect, useMemo, useRef, useState } from 'react';
import { ActiveInd, CATEGORIES, Category, IND_BY_ID, INDICATORS, defaultParams } from '../lib/indicators';
import { SERIES } from '../lib/theme';
import { uid } from '../lib/types';
import { Icon } from './Icon';

export function IndicatorPicker({ onClose, onAdd, existing }: { onClose: () => void; onAdd: (i: ActiveInd) => void; existing: ActiveInd[] }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | 'all'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const list = useMemo(() => {
    const n = q.trim().toLocaleLowerCase('tr');
    return INDICATORS.filter(
      (d) => (cat === 'all' || d.cat === cat) && (!n || d.name.toLocaleLowerCase('tr').includes(n) || d.short.toLocaleLowerCase('tr').includes(n)),
    );
  }, [q, cat]);

  const add = (id: string) => {
    const def = IND_BY_ID[id];
    const used = new Set(existing.flatMap((e) => e.colors));
    const free = SERIES.filter((c) => !used.has(c));
    const pool = [...free, ...SERIES];
    onAdd({ uid: uid(), id, params: defaultParams(def), colors: def.outputs.map((_, i) => pool[i % pool.length]) });
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-label="İndikatör ekle">
        <div className="dialog-head">
          <h2>İndikatör ekle</h2>
          <div className="search">
            <Icon name="search" size={18} />
            <input ref={inputRef} className="input" placeholder="Ara: RSI, Bollinger, VWAP…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="icon-btn" onClick={onClose} title="Kapat">
            <Icon name="close" />
          </button>
        </div>
        <div className="ind-body">
          <div className="ind-cats">
            <button aria-pressed={cat === 'all'} onClick={() => setCat('all')}>
              Tümü <span className="muted">{INDICATORS.length}</span>
            </button>
            {CATEGORIES.map((c) => (
              <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>
                {c} <span className="muted">{INDICATORS.filter((d) => d.cat === c).length}</span>
              </button>
            ))}
          </div>
          <div className="ind-list">
            {list.map((d) => {
              const count = existing.filter((e) => e.id === d.id).length;
              return (
                <button key={d.id} className="ind-row" onClick={() => add(d.id)}>
                  <span>
                    {d.name} <span className="s">{d.short}</span>
                  </span>
                  <span className="where">{d.pane === 'overlay' ? 'Grafik üstü' : 'Ayrı panel'}</span>
                  <span className="where" style={{ minWidth: 48, textAlign: 'right' }}>
                    {count ? `${count} ekli` : <Icon name="plus" size={16} />}
                  </span>
                </button>
              );
            })}
            {!list.length && <div className="empty">“{q}” ile eşleşen indikatör yok.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ParamPopover({ ind, x, y, onChange, onClose }: { ind: ActiveInd; x: number; y: number; onChange: (i: ActiveInd) => void; onClose: () => void }) {
  const def = IND_BY_ID[ind.id];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    setTimeout(() => window.addEventListener('mousedown', close));
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  if (!def) return null;
  return (
    <div ref={ref} className="param-pop" style={{ left: Math.min(x, window.innerWidth - 280), top: Math.min(y + 12, window.innerHeight - 320) }}>
      <h2>{def.name}</h2>
      {def.params.length > 0 && (
        <div className="grid">
          {def.params.map((p) => (
            <label key={p.key} className="field">
              <span>{p.label}</span>
              <input
                className="input"
                type="number"
                step={p.step}
                min={p.min}
                max={p.max}
                value={ind.params[p.key]}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isFinite(v)) return;
                  onChange({ ...ind, params: { ...ind.params, [p.key]: Math.max(p.min ?? -Infinity, Math.min(p.max ?? Infinity, v)) } });
                }}
              />
            </label>
          ))}
        </div>
      )}
      {def.outputs.map((o, i) => (
        <div key={o.key} className="field">
          <span>{o.label} rengi</span>
          <div className="swatches">
            {SERIES.map((c) => (
              <button
                key={c}
                aria-label={c}
                aria-pressed={ind.colors[i] === c}
                style={{ background: c }}
                onClick={() => {
                  const colors = [...ind.colors];
                  colors[i] = c;
                  onChange({ ...ind, colors });
                }}
              />
            ))}
          </div>
        </div>
      ))}
      <button className="btn sm" onClick={() => onChange({ ...ind, params: defaultParams(def) })}>
        Varsayılana dön
      </button>
    </div>
  );
}
