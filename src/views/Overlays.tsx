import { useApp } from '../store';
import { Icon } from '../components/Icon';
import { CertLabel } from '../components/bits';
import { Emblem } from '../components/Emblem';
import { goldPrice, longDate, clockUtc, money, signedMoney, rMult, plainPct } from '../lib/format';
import { summarize } from '../lib/stats';

export function Overlays() {
  const o = useApp((s) => s.overlay);
  const dismiss = useApp((s) => s.dismissOverlay);
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
              Tamam
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
              Tamam
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

  return null;
}

const REASON_TAG = { user: null, data: 'Veri bitti', violation: 'İhlal', funded: 'Fonlandı' } as const;

/** Session reports slide in at the bottom right and print row by row; nothing is interrupted. */
export function Notices() {
  const notices = useApp((s) => s.notices);
  const dismiss = useApp((s) => s.dismissNotice);
  if (!notices.length) return null;
  return (
    <div className="notices" aria-live="polite">
      {notices.map((n) => {
        const s = n.session;
        const sum = summarize(n.trades);
        const net = n.trades.reduce((a, t) => a + t.pnl, 0);
        const tag = REASON_TAG[n.reason];
        const rows: [string, React.ReactNode, boolean?][] = [
          ['Gerçek tarih', longDate(s.startMs), true],
          ['Saat (UTC)', `${clockUtc(s.startMs)} → ${clockUtc(s.clockMs)}${longDate(s.clockMs) !== longDate(s.startMs) ? ` · ${longDate(s.clockMs)}` : ''}`],
          ['XAUUSD', s.firstPrice && s.lastPrice ? `${goldPrice(s.firstPrice)} → ${goldPrice(s.lastPrice)}` : '—', true],
          ['Aralık', s.high && s.low ? `${goldPrice(s.low)} – ${goldPrice(s.high)}` : '—'],
          ['İşlem', sum.count ? `${sum.count} · ${plainPct(sum.winRate, 0)} kazanma` : 'İşlem yok'],
          [
            'Sonuç',
            <span key="r" className={net > 0 ? 'upc' : net < 0 ? 'downc' : ''}>
              {signedMoney(net)} · {rMult(sum.totalR)}
            </span>,
            true,
          ],
        ];
        return (
          <section key={n.id} className="notice print" role="status">
            <div className="print-head">
              <span>{n.account.no}</span>
              <span className="notice-r">
                {tag && <b className={`notice-tag ${n.reason}`}>{tag}</b>}
                Seans raporu
                <button className="notice-x" title="Kapat" onClick={() => dismiss(n.id)}>
                  <Icon name="close" size={14} />
                </button>
              </span>
            </div>
            <div className="print-rows">
              {rows.map(([k, v, big], i) => (
                <div key={k} className="print-row" style={{ animationDelay: `${520 + i * 200}ms` }}>
                  <span className="k">{k}</span>
                  <span className={`v ${big ? 'big' : ''}`}>{v}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
