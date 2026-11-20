import { useEffect } from 'react';
import { getFeed, useApp } from '../store';
import type { Side } from '../lib/types';
import { uid } from '../lib/types';
import { C } from '../lib/theme';
import { Icon } from './Icon';

/** Right-click menu on a chart: an order or a horizontal line at the clicked level. */
export function ChartMenu({ x, y, price, current, onClose }: { x: number; y: number; price: number; current: number; onClose: () => void }) {
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
