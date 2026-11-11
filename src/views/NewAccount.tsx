import { useState } from 'react';
import { useApp } from '../store';
import { PACKAGES } from '../lib/types';
import { PROGRAMS, salePrice, stepTargets } from '../lib/programs';
import { money, money0, sizeLabel } from '../lib/format';
import { Icon } from '../components/Icon';

const pctTr = (v: number) => '%' + String(v).replace('.', ',');

export function NewAccount() {
  const custom = useApp((s) => s.settings.rules);
  const S = useApp.getState;
  const [pid, setPid] = useState(PROGRAMS[0].id);
  const prog = PROGRAMS.find((p) => p.id === pid);
  const rules = prog ? prog.rules : custom;
  const targets = stepTargets(rules);

  return (
    <div className="page">
      <div className="page-head">
        <button className="icon-btn" title="Geri" onClick={() => S().go('dashboard')}>
          <Icon name="chevron" style={{ transform: 'rotate(90deg)' }} />
        </button>
        <h1>Yeni hesap</h1>
      </div>
      <div className="pkg-list">
        <div className="tabs-row pkg-tabs" role="tablist">
          {PROGRAMS.map((p) => (
            <button key={p.id} className="tab" role="tab" aria-selected={pid === p.id} onClick={() => setPid(p.id)}>
              {p.name} <span className="count">{p.kind}</span>
            </button>
          ))}
          <button className="tab" role="tab" aria-selected={pid === 'custom'} onClick={() => setPid('custom')}>
            Özel <span className="count">Ayarlar’dan</span>
          </button>
        </div>
        <div className="program-rules">
          <span>
            Hedef <b>{targets.map(pctTr).join(' → ')}</b>
          </span>
          <span>
            Günlük zarar <b>{pctTr(rules.dailyLoss)}</b>
          </span>
          <span>
            Toplam zarar <b>{pctTr(rules.maxLoss)}</b> {rules.maxType === 'trailing' ? 'takip eden' : 'sabit'}
          </span>
          {rules.consistencyPct ? (
            <span>
              Tutarlılık <b>en iyi gün ≤ {pctTr(rules.consistencyPct)}</b>
            </span>
          ) : null}
          <span>
            Asgari gün <b>{rules.minDays || 'yok'}</b>
            {rules.minDayPct ? ` kârlı (günde ≥ ${pctTr(rules.minDayPct)})` : ''}
          </span>
          <span>
            Kâr payı <b>{pctTr(rules.split)}</b>
          </span>
          {rules.payoutMinUsd ? (
            <span>
              En az ödeme <b>{money0(rules.payoutMinUsd)}</b>
            </span>
          ) : null}
          {rules.commissionPct ? (
            <span>
              Komisyon <b>{pctTr(rules.commissionPct)}</b> / yön
            </span>
          ) : null}
        </div>
        <div className="pkg-grid">
        {PACKAGES.map((size) => {
          const list = prog?.prices[size];
          const price = list !== undefined ? salePrice(list) : 0;
          return (
            <button key={size} className="pkg" disabled={!!prog && list === undefined} onClick={() => S().createAccount(size, prog?.id)}>
              <div className="cert">
                <div className="cert-main">
                  <div className="cert-no">{money0(size)}</div>
                  <div className="rule-strip">
                    <span>
                      <b>{targets.map((t) => money0((size * t) / 100)).join(' → ')}</b>hedef
                    </span>
                    <span>
                      <b>{money0((size * rules.dailyLoss) / 100)}</b>günlük limit
                    </span>
                    <span>
                      <b>{money0((size * rules.maxLoss) / 100)}</b>toplam limit
                    </span>
                  </div>
                </div>
                <div className="cert-grade">
                  <span className="g-value">{prog ? (list !== undefined ? money(price) : '—') : sizeLabel(size)}</span>
                  {prog && list !== undefined ? <span className="g-sub list-price">{money(list)}</span> : <span className="g-sub">{prog ? 'satışta yok' : 'ücretsiz'}</span>}
                </div>
              </div>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
