import { useMemo } from 'react';
import { useApp, accountLimits } from '../store';
import { CertLabel, EquityCurve, Heatmap, RuleGauges } from '../components/bits';
import { Icon } from '../components/Icon';
import { Emblem } from '../components/Emblem';
import { summarize } from '../lib/stats';
import { money, plainPct, sizeLabel, wallDate, wallDateTime } from '../lib/format';

export function Dashboard() {
  const accounts = useApp((s) => s.accounts);
  const trades = useApp((s) => s.trades);
  const session = useApp((s) => s.session);
  const live = useApp((s) => s.live);
  const S = useApp.getState;
  const sum = useMemo(() => summarize(trades), [trades]);
  const payouts = accounts.flatMap((a) => a.payouts.map((p) => ({ ...p, no: a.no, size: a.size }))).sort((a, b) => b.at - a.at);
  const totalPaid = payouts.reduce((s, p) => s + p.amount, 0);
  const active = accounts.filter((a) => a.status === 'active');

  if (!accounts.length) {
    return (
      <div className="page">
        <div className="first-run">
          <div className="inner">
            <Emblem width={168} />
            <h1>Henüz bir hesabın yok</h1>
            <p>
              Bir değerlendirme hesabı aç. Geçmişten rastgele bir anda, fiyat ve tarih gizliyken gold işlemi yaparsın. Kuralları aşmadan hedefe ulaşırsan hesap
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

  return (
    <div className="page">
      <div className="page-head">
        <h1>Hesaplar</h1>
        <div className="ledger">
          <span>
            Aktif <b>{active.length}</b>
          </span>
          <span>
            Toplam çekim <b>{money(totalPaid)}</b>
          </span>
          <span>
            Kazanma oranı <b>{sum.count ? plainPct(sum.winRate, 0) : '—'}</b>
          </span>
          <span>
            Kapanan işlem <b>{sum.count}</b>
          </span>
        </div>
        <div className="grow" />
        <button className="btn primary" onClick={() => S().go('new')}>
          <Icon name="plus" size={16} /> Yeni hesap
        </button>
      </div>
      <div className="page-body">
        <div className="acct-grid">
          {accounts.map((a) => {
            const isLive = session?.accountId === a.id;
            const lim = accountLimits(a, null);
            const hasOpen = useApp.getState().sessions.some((s) => s.accountId === a.id && !s.endedAt);
            return (
              <div key={a.id} className="acct">
                <CertLabel a={a} />
                <div className="acct-foot">
                  {a.status === 'violated' ? (
                    <>
                      <span className="void-note">
                        {a.violation} {a.violatedAt ? `· ${wallDateTime(a.violatedAt)}` : ''}
                      </span>
                      <div className="actions" />
                    </>
                  ) : (
                    <>
                      <RuleGauges a={a} s={isLive ? session : null} equity={isLive ? live.equity : a.balance} />
                      <div className="actions">
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

        <div className="dash-row">
          <section className="panel">
            <div className="panel-head">
              <h2>Kümülatif kâr / zarar</h2>
              <span className="muted">tüm hesaplar, kapanış sırasıyla</span>
            </div>
            <div className="panel-body">
              <EquityCurve points={sum.curve} height={220} />
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Saat × gün</h2>
              <span className="muted">hangi saatlerde iyisin</span>
            </div>
            <div className="panel-body">{trades.length ? <Heatmap trades={trades} /> : <div className="empty">İşlem yaptıkça burada saat ve gün desenin çıkacak.</div>}</div>
          </section>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>Ödemeler</h2>
            <span className="muted">{payouts.length ? `${payouts.length} ödeme` : ''}</span>
          </div>
          {payouts.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Hesap</th>
                  <th className="r">Brüt kâr</th>
                  <th className="r">Senin payın</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td>{wallDate(p.at)}</td>
                    <td>
                      {p.no} <span className="muted">· {sizeLabel(p.size)}</span>
                    </td>
                    <td className="r">{money(p.gross)}</td>
                    <td className="r up">{money(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Fonlu hesapta ödeme eşiğini geçince buradan sanal ödeme çekersin.</div>
          )}
        </section>
      </div>
    </div>
  );
}
