import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { store as db } from '../lib/db';
import { Icon } from '../components/Icon';
import { TradeChart } from '../components/TradeChart';
import { REASON } from './Trade';
import { instrumentOf } from '../lib/instruments';
import { goldPrice, longDate, clockUtc, lots as fmtLots, rMult, signedMoney, wallDate } from '../lib/format';

function Shot({ id, caption }: { id?: string; caption: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [big, setBig] = useState(false);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (id) db.shot(id).then((u) => alive && setUrl(u ?? null));
    return () => {
      alive = false;
    };
  }, [id]);
  return (
    <figure className="shot" style={{ margin: 0 }}>
      {url ? <img src={url} alt={caption} onClick={() => setBig(true)} /> : <div className="none">{id ? <span className="spin" /> : 'Görüntü yok'}</div>}
      <figcaption className="cap">{caption}</figcaption>
      {big && url && (
        <div className="lightbox" onClick={() => setBig(false)}>
          <img src={url} alt={caption} />
        </div>
      )}
    </figure>
  );
}

export function Journal() {
  const trades = useApp((s) => s.trades);
  const accounts = useApp((s) => s.accounts);
  const sessions = useApp((s) => s.sessions);
  const selId = useApp((s) => s.journalTradeId);
  const S = useApp.getState;
  const [acct, setAcct] = useState<string>(() => trades.find(t => t.id === selId)?.accountId ?? 'all');
  const archived = useMemo(() => new Set(accounts.filter((a) => a.archived).map((a) => a.id)), [accounts]);
  const list = useMemo(
    () =>
      trades
        .filter((t) => (acct === 'all' ? !archived.has(t.accountId) : acct === 'archived' ? archived.has(t.accountId) : t.accountId === acct))
        .sort((a, b) => b.realClosedAt - a.realClosedAt),
    [trades, acct, archived],
  );
  const sel = list.find((t) => t.id === selId) ?? list[0];
  const [note, setNote] = useState(sel?.note ?? '');
  useEffect(() => setNote(sel?.note ?? ''), [sel?.id]);
  const sess = sel ? sessions.find((s) => s.id === sel.sessionId) : undefined;
  const revealed = !!sess?.endedAt;
  const acctOf = (id: string) => accounts.find((a) => a.id === id);

  return (
    <div className="journal">
      <div className="journal-list">
        <div className="panel-head" style={{ position: 'sticky', top: 0, background: 'var(--ply-0)', zIndex: 2 }}>
          <h1 style={{ fontSize: 'var(--t-18)' }}>Günlük</h1>
          <div className="grow" />
          <select className="input" style={{ width: 200 }} value={acct} onChange={(e) => setAcct(e.target.value)} aria-label="Hesap">
            <option value="all">Tüm hesaplar</option>
            <option value="archived">Arşivdeki hesaplar</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.no}
              </option>
            ))}
          </select>
        </div>
        {list.length ? (
          <table className="tbl">
            <thead>
              <tr>
                <th>Gün</th>
                <th>Yön</th>
                <th>Çıkış</th>
                <th className="r">K/Z</th>
                <th className="r">R</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="clickable" aria-selected={sel?.id === t.id} onClick={() => S().openJournal(t.id)}>
                  <td>{wallDate(t.realClosedAt)}</td>
                  <td>
                    <span className={`side-tag ${t.side}`}>
                      <Icon name={t.side === 'long' ? 'up' : 'down'} size={14} /> {t.side === 'long' ? 'Long' : 'Short'}
                    </span>{' '}
                    <span className="muted">{instrumentOf(t).symbol}</span>
                  </td>
                  <td>{REASON[t.reason]}</td>
                  <td className={`r ${t.pnl > 0 ? 'up' : t.pnl < 0 ? 'down' : ''}`}>{signedMoney(t.pnl)}</td>
                  <td className="r">{rMult(t.r)}</td>
                  <td className="r">{t.note ? <Icon name="pencil" size={14} style={{ color: 'var(--ink-3)' }} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">Kapanan her işlem giriş ve çıkış görüntüleriyle buraya düşer.</div>
        )}
      </div>
      <div className="journal-detail">
        {sel ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <h1>
                <span className={sel.side === 'long' ? 'up' : 'down'}>{sel.side === 'long' ? 'Long' : 'Short'}</span> {fmtLots(sel.lots)} lot ·{' '}
                <span className={sel.pnl > 0 ? 'up' : sel.pnl < 0 ? 'down' : ''}>{signedMoney(sel.pnl)}</span>
              </h1>
              <div style={{ flex: 1 }} />
              <button className="btn" onClick={() => S().openReplay(sel.id)}>
                <Icon name="replay" size={16} /> Tekrar izle
              </button>
            </div>
            <dl className="kv" style={{ maxWidth: 560, fontSize: 'var(--t-13)' }}>
              <dt>Hesap</dt>
              <dd>{acctOf(sel.accountId)?.no ?? '—'}</dd>
              <dt>Sonuç</dt>
              <dd>
                {rMult(sel.r)} · {REASON[sel.reason]}
              </dd>
              <dt>Enstrüman</dt>
              <dd>{instrumentOf(sel).symbol} · {instrumentOf(sel).name}</dd>
              <dt>Emir tipi</dt>
              <dd>{sel.orderType === 'market' ? 'Piyasa' : sel.orderType === 'limit' ? 'Limit' : 'Stop'}</dd>
              <dt>Gerçek tarih</dt>
              <dd>{revealed ? `${longDate(sel.openedAt)} ${clockUtc(sel.openedAt)} UTC` : 'Seans bitince açılır'}</dd>
              <dt>Giriş → çıkış</dt>
              <dd>{revealed ? `${goldPrice(sel.entry)} → ${goldPrice(sel.exit)}` : 'Seans bitince açılır'}</dd>
            </dl>
            <TradeChart trade={sel} revealed={revealed} until={revealed ? undefined : sess?.clockMs} />
            <div className="shots">
              <Shot id={sel.shotOpen} caption="Giriş anı" />
              <Shot id={sel.shotClose} caption="Çıkış anı" />
            </div>
            <label className="field">
              <span>Not: neden girdin, ne hissettin, ne öğrendin</span>
              <textarea className="input" rows={6} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== sel.note && S().saveNote(sel.id, note)} />
            </label>
            {note !== sel.note && (
              <div>
                <button className="btn primary sm" onClick={() => S().saveNote(sel.id, note)}>
                  Notu kaydet
                </button>
              </div>
            )}
          </>
        ) : (
          list.length ? <div className="empty">Bir işlem seç.</div> : null
        )}
      </div>
    </div>
  );
}
