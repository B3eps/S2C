import { useEffect, useRef } from 'react';
import { m } from 'motion/react';
import type { PaneView } from '../store';
import { popover } from '../lib/motion';
import { Icon } from './Icon';

const VIEW_ROWS: { key: keyof PaneView; label: string; hint: string; standard: boolean }[] = [
  { key: 'hollow', label: 'İçi boş yükselen mum', hint: 'Yükselen mumlar yalnız çerçeveyle çizilir', standard: false },
  { key: 'bands', label: 'Seans bantları', hint: 'Asya, Londra ve New York arka planları', standard: true },
  { key: 'grid', label: 'Izgara', hint: 'Yatay ve dikey yardımcı çizgiler', standard: true },
  { key: 'log', label: 'Logaritmik ölçek', hint: 'Yüzde hareketleri eşit boyda görünür; kriptoda uzun aralıklar için', standard: false },
  { key: 'follow', label: 'Son mumu takip et', hint: 'Replay ilerledikçe grafik yeni mumla kayar', standard: true },
];

/** The look of one pane. Each row is a toggle; the checkmark shows what is on. */
export function PaneViewMenu({ view, at, onChange, onClose }: { view: PaneView; at: { x: number; y: number }; onChange: (v: PaneView) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest('.pane-view-btn')) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  const changed = VIEW_ROWS.some((r) => (view[r.key] ?? r.standard) !== r.standard);
  return (
    <m.div ref={ref} className="pane-view-menu" role="menu" aria-label="Grafik görünümü" style={{ left: at.x, top: at.y, transformOrigin: 'top left' }} {...popover}>
      <div className="flyout-title">Grafik görünümü</div>
      {VIEW_ROWS.map((r) => {
        const on = view[r.key] ?? r.standard;
        return (
          <button key={r.key} className="flyout-item" role="menuitemcheckbox" aria-checked={on} title={r.hint} onClick={() => onChange({ ...view, [r.key]: !on })}>
            <span className="tick">{on && <Icon name="check" size={14} />}</span>
            <span>{r.label}</span>
          </button>
        );
      })}
      <hr />
      <button className="flyout-item" disabled={!changed} onClick={() => onChange({})}>
        <span className="tick" />
        <span>Varsayılana dön</span>
      </button>
    </m.div>
  );
}
