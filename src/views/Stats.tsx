import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { summarize } from '../lib/stats';
import { EquityCurve, Heatmap } from '../components/bits';
import { money, plainPct, rMult, signedMoney } from '../lib/format';

export function Stats() {
  const trades = useApp((s) => s.trades);
  const accounts = useApp((s) => s.accounts);
  const [acct, setAcct] = useState('all');
  const list = useMemo(() => trades.filter((t) => acct === 'all' || t.accountId === acct), [trades, acct]);
  const s = useMemo(() => summarize(list), [list]);
  const longs = list.filter((t) => t.side === 'long');
  const shorts = list.filter((t) => t.side === 'short');
  const sl = summarize(longs);
  const ss = summarize(shorts);
  const pf = s.profitFactor === undefined ? '—' : s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2).replace('.', ',');

  const stats: [string, string, string?][] = [
    ['Net sonuç', signedMoney(s.net), s.net > 0 ? 'up' : s.net < 0 ? 'down' : ''],
    ['İşlem', String(s.count)],
    ['Kazanma oranı', s.count ? plainPct(s.winRate, 1) : '—'],
    ['Kâr faktörü', pf],
    ['Ortalama R', rMult(s.avgR)],
    ['Toplam R', rMult(s.totalR)],
    ['Ortalama kazanç', s.wins ? money(s.avgWin) : '—', 'up'],
    ['Ortalama kayıp', s.losses ? money(s.avgLoss) : '—', 'down'],
    ['En büyük düşüş', money(s.maxDD)],
    ['En uzun kazanç serisi', String(s.bestStreak)],
    ['En uzun kayıp serisi', String(s.worstStreak)],
    ['Long / Short', `${longs.length} / ${shorts.length}`],
  ];

  return (
    <div className="page">
      <div className="page-head">
        <h1>İstatistik</h1>
        <div className="grow" />
        <select className="input" style={{ width: 220 }} value={acct} onChange={(e) => setAcct(e.target.value)} aria-label="Hesap">
          <option value="all">Tüm hesaplar</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.no}
            </option>
          ))}
        </select>
      </div>
      <div className="page-body">
        <div className="stat-grid">
          {stats.map(([k, v, c]) => (
            <div key={k} className="stat">
              <span className="k">{k}</span>
              <span className={`v ${c ?? ''}`}>{v}</span>
            </div>
          ))}
        </div>
        <div className="dash-row">
          <section className="panel">
            <div className="panel-head">
              <h2>Kümülatif kâr / zarar</h2>
              <span className="muted">kırmızı alan: tepeden düşüş</span>
            </div>
            <div className="panel-body">
              <EquityCurve points={s.curve} height={260} />
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Saat × gün</h2>
            </div>
            <div className="panel-body">{list.length ? <Heatmap trades={list} /> : <div className="empty">Henüz işlem yok.</div>}</div>
          </section>
        </div>
        <section className="panel">
          <div className="panel-head">
            <h2>Yöne göre</h2>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Yön</th>
                <th className="r">İşlem</th>
                <th className="r">Kazanma</th>
                <th className="r">Ortalama R</th>
                <th className="r">Net</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Long', sl],
                  ['Short', ss],
                ] as const
              ).map(([k, x]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td className="r">{x.count}</td>
                  <td className="r">{x.count ? plainPct(x.winRate, 1) : '—'}</td>
                  <td className="r">{rMult(x.avgR)}</td>
                  <td className={`r ${x.net > 0 ? 'up' : x.net < 0 ? 'down' : ''}`}>{signedMoney(x.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
