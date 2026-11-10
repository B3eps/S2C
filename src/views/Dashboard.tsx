import { useState } from 'react';
import { useApp, payoutBlocker, accountLimits } from '../store';
import { CertLabel, RuleGauges } from '../components/bits';
import { Icon } from '../components/Icon';
import { Emblem } from '../components/Emblem';
import { money, wallDateTime } from '../lib/format';
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

  if (!accounts.length) {
    return (
      <div className="page dashboard-start">
        <div className="dashboard-start-head"><div><h1>Hesaplar</h1><p>Fon hesapların</p></div><button className="btn primary" onClick={() => S().go('new')}><Icon name="plus" size={16} /> Yeni hesap</button></div>
        <div className="dashboard-start-layout">
          <section className="panel dashboard-start-main">
            <div className="dashboard-start-brand"><Emblem width={88} /><span>XAUUSD · Kör replay</span></div>
            <div><h2>Henüz bir hesabın yok</h2><p>Bir hesap oluştur; durumunu, kurallarını ve ilerlemeni buradan takip et.</p></div>
            <button className="btn primary lg" onClick={() => S().go('new')}><Icon name="plus" size={18} /> Hesap seç</button>
          </section>
        </div>
      </div>
    );
  }

  const list = accounts.filter((a) => inTab(a, tab));

  return (
    <div className="page accounts-page">
      <div className="page-head accounts-head">
        <div><h1>Hesaplar</h1><p>Fon hesaplarını ve kurallarını buradan takip et.</p></div>
        <div className="grow" />
        <button className="btn primary" onClick={() => S().go('new')}>
          <Icon name="plus" size={16} /> Yeni hesap
        </button>
      </div>
      <div className="page-body">
        <div className="accounts-list-head"><div><h2>Hesaplarım</h2><span>{list.length} hesap</span></div><p>Hesap durumuna göre görüntüle</p></div>
        <div className="tabs-row accounts-tabs" role="tablist" aria-label="Hesap durumu">
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
              const hasOpen = sessions.some((s) => s.accountId === a.id && !s.endedAt);
              const archiveBtn = (
                <button className="icon-btn" title={a.archived ? 'Arşivden çıkar' : 'Arşive at'} onClick={() => S().archiveAccount(a.id, !a.archived)}>
                  <Icon name={a.archived ? 'upload' : 'download'} size={18} />
                </button>
              );
              return (
                <div key={a.id} className="acct account-card">
                  <div className="account-card-top"><span>{a.phase === 'challenge' && !a.archived && a.status === 'active'
                    ? `Hedefe kalan ${money(Math.max(0, accountLimits(a, null).target - a.balance))}` : a.programName || 'Özel hesap'}</span><span className={`account-status ${a.status === 'violated' ? 'down' : ''}`}>{a.archived ? 'Arşivde' : a.status === 'violated' ? 'İhlal' : a.phase === 'funded' ? 'Fonlu' : 'Değerlendirmede'}</span></div>
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
                            <button
                              className="btn"
                              disabled={!!payoutBlocker(a, isLive ? session?.positions.length ?? 0 : 0)}
                              title={payoutBlocker(a, isLive ? session?.positions.length ?? 0 : 0) ?? undefined}
                              onClick={() => S().requestPayout(a.id)}
                            >
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

      </div>
    </div>
  );
}
