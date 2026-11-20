import { useMemo } from 'react';
import { useApp, ticketLots, pnlOf, riskOf, markPrice, spreadOf } from '../store';
import type { LineTarget } from '../store';
import type { Side } from '../lib/types';
import { C } from '../lib/theme';
import { lots as fmtLots, rMult, signedMoney } from '../lib/format';

/** Order, stop and target lines of the open session, as tags on the chart (ChartPanel). */
type Target = LineTarget;
export type Field = 'sl' | 'tp';
export interface OLine {
  key: string;
  price: number;
  cls: string;
  k: string;
  v: string;
  target: Target;
  draggable: boolean;
  onClose?: () => void;
  closeTitle?: string;
  /** levels this entry is missing: shown as SL / TP buttons you can click or drag out */
  missing?: Field[];
  color: string;
  dashed: boolean;
}

const sideWord =(s: Side) => (s === 'long' ? 'Long' : 'Short');
const typeWord = { market: 'Piyasa', limit: 'Limit', stop: 'Stop' } as const;

/**
 * One rule for every owner of lines (draft ticket, pending order, open position):
 *  - the entry tag names the side; its type and size sit in the value, so dragging a pending
 *    order across the price only changes the word Limit/Stop, never the tag's identity;
 *  - every SL and TP tag drags freely and has its own ✕;
 *  - a missing SL or TP shows as a button on the entry tag: click to place it, or drag it out.
 */
export function useLines(): OLine[] {
  const session = useApp((s) => s.session);
  const ticket = useApp((s) => s.ticket);
  const live = useApp((s) => s.live);
  const accounts = useApp((s) => s.accounts);
  const spread = useApp((s) => spreadOf(s.settings));
  const account = accounts.find((a) => a.id === session?.accountId);
  const S = useApp.getState;

  return useMemo(() => {
    const out: OLine[] = [];
    if (!session || !account) return out;
    const bal = account.balance;
    const lvl = (side: Side, entry: number, at: number, lots: number, sl?: number) => {
      const pnl = pnlOf(side, entry, at, lots);
      const risk = riskOf(entry, sl, lots);
      return `${risk ? rMult(pnl / risk) + ' · ' : ''}${signedMoney(pnl)}`;
    };
    const missing = (sl?: number, tp?: number): Field[] => [...(sl === undefined ? ['sl' as const] : []), ...(tp === undefined ? ['tp' as const] : [])];
    const levels = (prefix: string, side: Side, entry: number, lots: number, sl: number | undefined, tp: number | undefined, kind: Target['kind'], id: string | undefined, cls: string, riskSl = sl) => {
      if (sl !== undefined)
        out.push({
          key: `${prefix}-sl`,
          price: sl,
          cls: `sl ${cls}`,
          k: 'SL',
          v: lvl(side, entry, sl, lots, riskSl),
          target: { kind, id, field: 'sl' },
          draggable: true,
          color: C.down,
          dashed: kind !== 'pos',
          onClose: () => S().clearLevel({ kind, id, field: 'sl' }),
          closeTitle: 'SL’yi kaldır',
        });
      if (tp !== undefined)
        out.push({
          key: `${prefix}-tp`,
          price: tp,
          cls: `tp ${cls}`,
          k: 'TP',
          v: lvl(side, entry, tp, lots, riskSl),
          target: { kind, id, field: 'tp' },
          draggable: true,
          color: C.up,
          dashed: kind !== 'pos',
          onClose: () => S().clearLevel({ kind, id, field: 'tp' }),
          closeTitle: 'TP’yi kaldır',
        });
    };

    for (const p of session.positions) {
      const floating = pnlOf(p.side, p.entry, markPrice(p.side, live.price, spread), p.lots);
      const risk = riskOf(p.entry, p.initialSl, p.lots);
      out.push({
        key: `p-${p.id}`,
        price: p.entry,
        cls: `entry static ${p.side}`,
        k: `${sideWord(p.side)} ${fmtLots(p.lots)}`,
        v: `${risk ? rMult(floating / risk) + ' · ' : ''}${signedMoney(floating)}`,
        target: { kind: 'pos', id: p.id, field: 'entry' },
        draggable: false,
        onClose: () => S().closePosition(p.id),
        closeTitle: 'Pozisyonu kapat',
        missing: missing(p.sl, p.tp),
        color: p.side === 'long' ? C.up : C.down,
        dashed: false,
      });
      levels(`p-${p.id}`, p.side, p.entry, p.lots, p.sl, p.tp, 'pos', p.id, '', p.initialSl ?? p.sl);
    }
    for (const o of session.orders) {
      out.push({
        key: `o-${o.id}`,
        price: o.price,
        cls: `entry pending ${o.side}`,
        k: sideWord(o.side),
        v: `${typeWord[o.type]} · ${fmtLots(o.lots)} lot`,
        target: { kind: 'order', id: o.id, field: 'entry' },
        draggable: true,
        onClose: () => S().cancelOrder(o.id),
        closeTitle: 'Emri iptal et',
        missing: missing(o.sl, o.tp),
        color: C.ink2,
        dashed: true,
      });
      levels(`o-${o.id}`, o.side, o.price, o.lots, o.sl, o.tp, 'order', o.id, 'pending');
    }
    if (ticket) {
      const entry = ticket.type === 'market' ? live.price : ticket.entry;
      const l = ticketLots(ticket, bal, entry);
      out.push({
        key: 't-entry',
        price: entry,
        cls: `entry ghost ${ticket.side}`,
        k: sideWord(ticket.side),
        v: `${typeWord[ticket.type]} · ${fmtLots(l)} lot`,
        target: { kind: 'ticket', field: 'entry' },
        draggable: true,
        onClose: () => S().cancelTicket(),
        closeTitle: 'Taslağı sil',
        missing: missing(ticket.sl, ticket.tp),
        color: C.gold,
        dashed: true,
      });
      levels('t', ticket.side, entry, l, ticket.sl, ticket.tp, 'ticket', undefined, 'ghost');
    }
    return out;
  }, [session, ticket, live.price, account, spread]);
}
