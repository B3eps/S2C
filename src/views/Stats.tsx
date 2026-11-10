import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { summarize } from '../lib/stats';
import { EquityCurve, Heatmap } from '../components/bits';
import { money, plainPct, rMult, signedMoney } from '../lib/format';
import { PerformanceCalendar } from '../components/PerformanceCalendar';

export function Stats() {
  const trades = useApp((s) => s.trades);
  const accounts = useApp((s) => s.accounts);
  const [acct, setAcct] = useState('all');
  const [withArchived, setWithArchived] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const archived = useMemo(() => new Set(accounts.filter((a) => a.archived).map((a) => a.id)), [accounts]);
  const list = useMemo(
    () => trades.filter((t) => {
      const d = new Date(t.realClosedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return (acct === 'all' ? withArchived || !archived.has(t.accountId) : t.accountId === acct) && (!fromDate || key >= fromDate) && (!toDate || key <= toDate);
    }),
    [trades, acct, withArchived, archived, fromDate, toDate],
  );
  const s = useMemo(() => summarize(list), [list]);
  const accts = accounts.filter((a) => (acct === 'all' ? withArchived || !a.archived : a.id === acct));
  const spent = accts.reduce((x, a) => x + (a.fee ?? 0), 0);
  const earned = accts.reduce((x, a) => x + a.payouts.reduce((y, p) => y + p.amount, 0), 0);
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
    ['Kazanç / kayıp', `${s.wins} / ${s.losses}`],
  ];

  return (
    <div className="page stats-page">
      <div className="stats-header">
        <div><h1>İstatistik</h1><p>İşlem performansın ve hesap sonuçların</p></div>
        <div className="stats-filters">
        <label className="check">
          <input type="checkbox" checked={withArchived} onChange={(e) => setWithArchived(e.target.checked)} /> Arşivdekileri dahil et
        </label>
        <select className="input" style={{ width: 220 }} value={acct} onChange={(e) => setAcct(e.target.value)} aria-label="Hesap">
          <option value="all">Tüm hesaplar</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.no}
            </option>
          ))}
        </select>
        <label className="field"><span>Başlangıç</span><input className="input" type="date" aria-label="Başlangıç tarihi" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} /></label>
        <label className="field"><span>Bitiş</span><input className="input" type="date" aria-label="Bitiş tarihi" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} /></label>
        {(fromDate || toDate) && <button className="btn sm" onClick={() => { setFromDate(''); setToDate(''); }}>Tarihleri temizle</button>}
        </div>
      </div>
      <div className="page-body">
        <div className="dash-row stats-charts">
          <section className="panel">
            <div className="panel-head">
              <h2>Kümülatif kâr / zarar</h2>
              <span className="muted">kırmızı alan: tepeden düşüş</span>
            </div>
            <div className="panel-body">
              {s.count ? <EquityCurve points={s.curve} height={260} /> : <div className="chart-empty" style={{ height: 260 }}><span>İlk işlemin tamamlandığında performans eğrin burada görünecek.</span></div>}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>İşlem sonuçları</h2>
            </div>
            <div className="panel-body outcome-chart">
              <div className="outcome-heading"><strong>{s.count ? plainPct(s.winRate, 1) : '—'}</strong><span>Kazanma oranı</span></div>
              <div className="outcome-track" aria-label={`${s.wins} kazanç, ${s.losses} kayıp, ${s.count - s.wins - s.losses} başa baş`}>
                {s.count > 0 && <><span className="outcome-win" style={{ width: `${100 * s.wins / s.count}%` }} /><span className="outcome-loss" style={{ width: `${100 * s.losses / s.count}%` }} /><span className="outcome-flat" style={{ width: `${100 * (s.count - s.wins - s.losses) / s.count}%` }} /></>}
              </div>
              <div className="outcome-list"><div><span>Kazanç</span><strong className="up">{s.wins}</strong></div><div><span>Kayıp</span><strong className="down">{s.losses}</strong></div><div><span>Başa baş</span><strong>{s.count - s.wins - s.losses}</strong></div></div>
              {!s.count && <p className="muted">İşlemler tamamlandıkça dağılım burada görünür.</p>}
            </div>
          </section>
        </div>
        <div className="stats-overview">
          <div className="stats-primary"><span>İşlem net sonucu</span><strong className={s.net > 0 ? 'up' : s.net < 0 ? 'down' : ''}>{s.count ? signedMoney(s.net) : '—'}</strong><small>{s.count ? `${s.count} tamamlanan işlem` : 'Henüz tamamlanan işlem yok'}</small></div>
          <div className="stats-key"><span>Kazanma oranı</span><strong>{s.count ? plainPct(s.winRate, 1) : '—'}</strong><small>{s.wins} kazanç / {s.losses} kayıp</small></div>
          <div className="stats-key"><span>Ortalama R</span><strong>{rMult(s.avgR)}</strong><small>Risk ölçüsü olan işlemler</small></div>
          <div className="stats-key"><span>Kâr faktörü</span><strong>{pf}</strong><small>Brüt kazanç / brüt kayıp</small></div>
        </div>
        <div className="stats-section-title"><h2>Performans</h2><span>Seçili hesapların tamamlanan işlemleri</span></div>
        <div className="stats-detail-grid">
          {stats.slice(5).map(([k, v, c]) => <div key={k} className="stats-detail"><span>{k}</span><strong className={c ?? ''}>{v}</strong></div>)}
        </div>
        <PerformanceCalendar trades={list} />
        <section className="panel stats-heat"><div className="panel-head"><h2>Saat × gün</h2><span className="muted">İşlemlerin giriş saatlerine göre</span></div><div className="panel-body">{list.length ? <Heatmap trades={list} /> : <div className="empty">İşlem saatlerinin dağılımı burada görünecek.</div>}</div></section>
        <div className="stats-section-title"><h2>Hesap hareketleri</h2><span>Seçili hesapların tüm zamanlardaki ücretleri ve ödemeleri</span></div>
        <div className="stats-money">
          <div><span>Harcanan</span><strong className="down">{money(spent)}</strong></div>
          <div><span>Çekilen</span><strong className="up">{money(earned)}</strong></div>
          <div><span>Net</span><strong className={earned - spent > 0 ? 'up' : earned - spent < 0 ? 'down' : ''}>{signedMoney(earned - spent)}</strong></div>
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
