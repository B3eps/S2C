import { useState } from 'react';
import { useApp, accountLimits } from '../store';
import { CertLabel, RuleGauges } from '../components/bits';
import { Icon } from '../components/Icon';
import { Emblem } from '../components/Emblem';
import { money, signedMoney, sizeLabel, wallDate, wallDateTime } from '../lib/format';
import type { Account } from '../lib/types';

type Tab = 'active' | 'funded' | 'violated' | 'archived';
const TABS: [Tab, string][] = [
  ['active', 'Değerlendirmede'],
  ['funded', 'Fonlu'],
  ['violated', 'İhlal'],
  ['archived', 'Arşiv'],
];
const inTab = (a: Account, t: Tab) =>
  t === 'archived' ? !!a.archived : !a.archived && (t === 'violated' ? a.status === 'violated' : a.status === 'active' && (t === 'funded' ? a.phase === 'funded' : a.phase === 'challenge'));

export function Dashboard() {
  const accounts = useApp((s) => s.accounts);
  const session = useApp((s) => s.session);
  const sessions = useApp((s) => s.sessions);
  const live = useApp((s) => s.live);
  const S = useApp.getState;
  const [tab, setTab] = useState<Tab>(() => (accounts.some((a) => inTab(a, 'active')) ? 'active' : accounts.some((a) => inTab(a, 'funded')) ? 'funded' : 'active'));

  const spent = accounts.reduce((s, a) => s + (a.fee ?? 0), 0);
  const earned = accounts.reduce((s, a) => s + a.payouts.reduce((x, p) => x + p.amount, 0), 0);
  const ledger = [
    ...accounts.filter((a) => a.fee).map((a) => ({ id: 'f' + a.id, at: a.createdAt, no: a.no, size: a.size, what: `Hesap alımı · ${a.programName ?? ''}`, amount: -(a.fee ?? 0) })),
    ...accounts.flatMap((a) => a.payouts.map((p) => ({ id: p.id, at: p.at, no: a.no, size: a.size, what: 'Ödeme (senin payın)', amount: p.amount }))),
  ].sort((x, y) => y.at - x.at);

  if (!accounts.length) {
    return (
      <div className="page">
        <div className="first-run">
          <div className="inner">
            <Emblem width={168} />
            <h1>Henüz bir hesabın yok</h1>
            <p>
              Bir değerlendirme hesabı aç. Geçmişten rastgele bir anda, fiyat ve tarih gizliyken XAUUSD işlemi yaparsın. Kuralları aşmadan hedefe ulaşırsan hesap
              fonlanır ve sanal ödeme çekebilirsin.
            </p>
            <button className="btn primary lg" onClick={() => S().go('new')}>
              <Icon name="plus" size={18} /> İlk hesabını aç
            </button>
          </div>
        </div>
      </div>
    );
  }

  const list = accounts.filter((a) => inTab(a, tab));

  return (
    <div className="page">
      <div className="page-head">
        <h1>Hesaplar</h1>
        <div className="ledger">
          <span>
            Harcanan <b className="down">{money(spent)}</b>
          </span>
          <span>
            Çekilen <b className="up">{money(earned)}</b>
          </span>
          <span>
            Net <b className={earned - spent >= 0 ? 'up' : 'down'}>{signedMoney(earned - spent)}</b>
          </span>
        </div>
        <div className="grow" />
        <button className="btn primary" onClick={() => S().go('new')}>
          <Icon name="plus" size={16} /> Yeni hesap
        </button>
      </div>
      <div className="page-body">
        <div className="tabs-row" role="tablist">
          {TABS.map(([t, label]) => (
            <button key={t} className="tab" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {label} <span className="count">{accounts.filter((a) => inTab(a, t)).length}</span>
            </button>
          ))}
        </div>
        {list.length ? (
          <div className="acct-grid">
            {list.map((a) => {
              const isLive = session?.accountId === a.id;
              const lim = accountLimits(a, null);
              const hasOpen = sessions.some((s) => s.accountId === a.id && !s.endedAt);
              const archiveBtn = (
                <button className="icon-btn" title={a.archived ? 'Arşivden çıkar' : 'Arşive at'} onClick={() => S().archiveAccount(a.id, !a.archived)}>
                  <Icon name={a.archived ? 'upload' : 'download'} size={18} />
                </button>
              );
              return (
                <div key={a.id} className="acct">
                  <CertLabel a={a} />
                  <div className="acct-foot">
                    {a.status === 'violated' || a.archived ? (
                      <>
                        <span className="void-note">
                          {a.status === 'violated' ? `${a.violation ?? ''} ${a.violatedAt ? `· ${wallDateTime(a.violatedAt)}` : ''}` : 'Arşivde. Panelde gizli, istatistikte isteğe bağlı.'}
                        </span>
                        <div className="actions">{archiveBtn}</div>
                      </>
                    ) : (
                      <>
                        <RuleGauges a={a} s={isLive ? session : null} equity={isLive ? live.equity : a.balance} />
                        <div className="actions">
                          {archiveBtn}
                          {a.phase === 'funded' && (
                            <button className="btn" disabled={a.balance < lim.payoutAt || (isLive && !!session?.positions.length)} onClick={() => S().requestPayout(a.id)}>
                              <Icon name="coin" size={16} /> Ödeme iste
                            </button>
                          )}
                          <button className="btn primary" onClick={() => (isLive ? S().go('trade') : S().startSession(a.id))}>
                            {isLive || hasOpen ? 'Seansa dön' : 'Seans başlat'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty" style={{ marginBottom: 32 }}>
            {tab === 'archived' ? 'Arşivde hesap yok. Bir hesabın kartındaki arşiv düğmesiyle buraya taşıyabilirsin.' : 'Bu kategoride hesap yok.'}
          </div>
        )}

        <section className="panel">
          <div className="panel-head">
            <h2>Para hareketleri</h2>
            <span className="muted">hesap alımları %40 indirimli fiyattan</span>
          </div>
          {ledger.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Hesap</th>
                  <th>Hareket</th>
                  <th className="r">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((p) => (
                  <tr key={p.id}>
                    <td>{wallDate(p.at)}</td>
                    <td>
                      {p.no} <span className="muted">· {sizeLabel(p.size)}</span>
                    </td>
                    <td>{p.what}</td>
                    <td className={`r ${p.amount >= 0 ? 'up' : 'down'}`}>{signedMoney(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Hesap aldıkça ve ödeme çektikçe burada görünür.</div>
          )}
        </section>
      </div>
    </div>
  );
}
