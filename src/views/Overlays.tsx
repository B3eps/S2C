import { useEffect } from 'react';
import { useApp } from '../store';
import { CertLabel } from '../components/bits';
import { Emblem } from '../components/Emblem';
import { goldPrice, longDate, clockUtc, money, signedMoney, rMult, plainPct } from '../lib/format';
import { summarize } from '../lib/stats';

export function Overlays() {
  const o = useApp((s) => s.overlay);
  const dismiss = useApp((s) => s.dismissOverlay);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (o && (e.key === 'Enter' || e.key === 'Escape')) dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [o, dismiss]);
  if (!o) return null;

  if (o.kind === 'funded')
    return (
      <div className="moment" role="dialog" aria-label="Hesap fonlandı">
        <div className="moment-card">
          <Emblem width={120} />
          <div className="moment-title gold">Fonlandın</div>
          <p className="lead">
            {o.account.no} değerlendirmeyi geçti. Hesap artık fonlu: kurallar aynı, hedef yok. Ödeme eşiğini geçince kârının %{o.account.rules.split}’ini
            çekebilirsin.
          </p>
          <CertLabel a={o.account} className="seal-in" />
          <div className="actions">
            <button className="btn primary lg" onClick={dismiss} autoFocus>
              Seansın gerçek tarihini gör
            </button>
          </div>
        </div>
      </div>
    );

  if (o.kind === 'violation')
    return (
      <div className="moment violation" role="dialog" aria-label="Hesap ihlal edildi">
        <div className="moment-card">
          <div className="moment-title red">Hesap kapandı</div>
          <p className="lead">{o.reason} Açık pozisyonlar kapatıldı, bekleyen emirler iptal edildi. Bu hesap panelde damgalı olarak kalır.</p>
          <CertLabel a={o.account} stampAnim />
          <div className="actions">
            <button className="btn lg" onClick={dismiss} autoFocus>
              Seansın gerçek tarihini gör
            </button>
          </div>
        </div>
      </div>
    );

  if (o.kind === 'payout')
    return (
      <div className="moment" role="dialog" aria-label="Ödeme">
        <div className="moment-card">
          <div className="moment-title gold">{money(o.amount)}</div>
          <p className="lead">
            Brüt kâr {money(o.gross)}, payın %{o.account.rules.split}. Hesap bakiyesi {money(o.account.size)} olarak yenilendi.
          </p>
          <CertLabel a={o.account} className="seal-in" />
          <div className="actions">
            <button className="btn primary lg" onClick={dismiss} autoFocus>
              Tamam
            </button>
          </div>
        </div>
      </div>
    );

  // reveal: the label prints the truth line by line
  const s = o.session;
  const sum = summarize(o.trades);
  const net = o.trades.reduce((a, t) => a + t.pnl, 0);
  const rows: [string, React.ReactNode, boolean?][] = [
    ['Gerçek tarih', longDate(s.startMs), true],
    ['Başlangıç → bitiş (UTC)', `${clockUtc(s.startMs)} → ${longDate(s.clockMs)} ${clockUtc(s.clockMs)}`],
    ['Gold fiyatı', s.firstPrice && s.lastPrice ? `${goldPrice(s.firstPrice)} → ${goldPrice(s.lastPrice)}` : '—', true],
    ['Seans aralığı', s.high && s.low ? `En düşük ${goldPrice(s.low)} · en yüksek ${goldPrice(s.high)}` : '—'],
    ['İşlem', `${sum.count} işlem · ${sum.count ? plainPct(sum.winRate, 0) + ' kazanma' : 'işlem yok'}`],
    [
      'Sonuç',
      <span key="r" className={net > 0 ? 'upc' : net < 0 ? 'downc' : ''}>
        {signedMoney(net)} · {rMult(sum.totalR)}
      </span>,
      true,
    ],
  ];
  return (
    <div className="moment" role="dialog" aria-label="Seans sonucu">
      <div className="moment-card" style={{ width: 680 }}>
        <div className="print">
          <div className="print-head">
            <span>{o.account.no}</span>
            <span>Seans raporu</span>
          </div>
          <div className="print-rows">
            {rows.map(([k, v, big], i) => (
              <div key={k} className="print-row" style={{ animationDelay: `${180 + i * 230}ms` }}>
                <span className="k">{k}</span>
                <span className={`v ${big ? 'big' : ''}`}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="actions">
          <button className="btn primary lg" onClick={dismiss} autoFocus>
            Panele dön
          </button>
        </div>
      </div>
    </div>
  );
}
