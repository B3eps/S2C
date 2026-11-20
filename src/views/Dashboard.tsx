import { useEffect, useState } from 'react';
import { downloadBackup, store as db } from '../lib/db';
import { useApp, payoutBlocker, accountLimits } from '../store';
import { CertLabel, RuleGauges } from '../components/bits';
import { Icon } from '../components/Icon';
import { Emblem } from '../components/Emblem';
import { money, wallDateTime } from '../lib/format';
import type { Account } from '../lib/types';
import { INSTRUMENTS, InstrumentId } from '../lib/instruments';

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
  const trades = useApp((s) => s.trades);
  const S = useApp.getState;
  const net = trades.reduce((t, x) => t + x.pnl, 0);
  /** instrument chosen per account for its next session */
  const [picks, setPicks] = useState<Record<string, InstrumentId>>({});
  const [tab, setTab] = useState<Tab>(() => (accounts.some((a) => inTab(a, 'active')) ? 'active' : accounts.some((a) => inTab(a, 'funded')) ? 'funded' : 'active'));

  if (!accounts.length) {
    return (
      <div className="page dashboard-start">
        <div className="dashboard-start-head"><div><h1>Hesaplar</h1><p>Fon hesapların</p></div><button className="btn primary" onClick={() => S().go('new')}><Icon name="plus" size={16} /> Yeni hesap</button></div>
        <div className="dashboard-start-layout">
          <section className="panel dashboard-start-main">
            <div className="dashboard-start-brand"><Emblem width={88} /><span>Kör replay</span></div>
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
        {trades.length > 0 && (
          <div className="ledger" aria-label="Toplam">
            <span>Seans <b>{sessions.length}</b></span>
            <span>İşlem <b>{trades.length}</b></span>
            <span>Net <b className={net > 0 ? 'up' : net < 0 ? 'down' : ''}>{money(net)}</b></span>
          </div>
        )}
        <button className="btn primary" onClick={() => S().go('new')}>
          <Icon name="plus" size={16} /> Yeni hesap
        </button>
      </div>
      <div className="page-body">
        <BackupNudge hasData={trades.length > 0} />
        <div className="accounts-list-head"><div><h2>Hesaplarım</h2><span>{list.length} hesap</span></div></div>
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
                          {!isLive && !hasOpen && (
                            <select className="input instrument-pick" aria-label="Enstrüman" value={picks[a.id] ?? 'xauusd'} onChange={(e) => setPicks({ ...picks, [a.id]: e.target.value as InstrumentId })}>
                              {INSTRUMENTS.map((i) => <option key={i.id} value={i.id}>{i.symbol} · {i.name}</option>)}
                            </select>
                          )}
                          <button className="btn primary" onClick={() => (isLive ? S().go('trade') : S().startSession(a.id, picks[a.id] ?? 'xauusd'))}>
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

const DAY = 86_400_000;
/** Records live only in this browser: after a week without a backup, say so once on the dashboard. */
function BackupNudge({ hasData }: { hasData: boolean }) {
  const [last, setLast] = useState<number | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void db.kv<number>('lastBackupAt').then((v) => setLast(v ?? null));
  }, []);
  if (!hasData || last === undefined || (last !== null && Date.now() - last < 7 * DAY)) return null;
  const days = last === null ? null : Math.floor((Date.now() - last) / DAY);
  return (
    <div className="backup-nudge" role="status">
      <Icon name="warn" size={16} />
      <span>
        {days === null ? 'Henüz yedek alınmadı.' : `Son yedek ${days} gün önce alındı.`} Hesapların ve günlüğün yalnız bu tarayıcıda duruyor.
      </span>
      <button
        className="btn sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await downloadBackup();
            setLast(Date.now());
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="download" size={14} /> Yedeği indir
      </button>
    </div>
  );
}
