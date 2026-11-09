import { useApp } from '../store';
import { PACKAGES, Account } from '../lib/types';
import { money0, sizeLabel } from '../lib/format';
import { Icon } from '../components/Icon';

export function NewAccount() {
  const rules = useApp((s) => s.settings.rules);
  const S = useApp.getState;
  return (
    <div className="page">
      <div className="page-head">
        <button className="icon-btn" title="Geri" onClick={() => S().go('dashboard')}>
          <Icon name="chevron" style={{ transform: 'rotate(90deg)' }} />
        </button>
        <h1>Yeni değerlendirme hesabı</h1>
        <div className="ledger">
          <span>Kuralları Ayarlar’dan değiştirebilirsin. Açılan hesap o anki kuralları saklar.</span>
        </div>
      </div>
      <div className="pkg-list">
        {PACKAGES.map((size) => {
          const a: Account = {
            id: 'preview',
            no: `${sizeLabel(size)} XAU`,
            size,
            phase: 'challenge',
            status: 'active',
            createdAt: 0,
            balance: size,
            rules,
            tradingDays: [],
            payouts: [],
          };
          return (
            <button key={size} className="pkg" onClick={() => S().createAccount(size)}>
              <div className="cert">
                <div className="cert-main">
                  <div className="cert-top">
                    <span>Altın · XAU</span>
                    <span className="sep" />
                    <span>Değerlendirme</span>
                  </div>
                  <div className="cert-no">{money0(size)}</div>
                  <div className="rule-strip">
                    <span>
                      <b>{money0((size * rules.target) / 100)}</b>hedef %{rules.target}
                    </span>
                    <span>
                      <b>{money0((size * rules.dailyLoss) / 100)}</b>günlük limit %{rules.dailyLoss}
                    </span>
                    <span>
                      <b>{money0((size * rules.maxLoss) / 100)}</b>toplam limit %{rules.maxLoss}
                    </span>
                    <span>
                      <b>{rules.minDays}</b>asgari gün
                    </span>
                    <span>
                      <b>%{rules.split}</b>kâr payı
                    </span>
                    <span>
                      <b>%{rules.payoutMin}</b>ödeme eşiği
                    </span>
                  </div>
                </div>
                <div className="cert-grade">
                  <span className="g-label">Aç</span>
                  <span className="g-value">{sizeLabel(a.size)}</span>
                  <span className="g-sub">seans hemen başlar</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
