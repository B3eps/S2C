import { useRef, useState } from 'react';
import { useApp } from '../store';
import { exportBackup, importBackup } from '../lib/db';
import { DEFAULT_RULES, Rules } from '../lib/types';
import { play } from '../lib/sound';
import { Icon } from '../components/Icon';

const FIELDS: [keyof Rules, string, number, number, number][] = [
  ['target', 'Kâr hedefi (%)', 0.5, 50, 0.5],
  ['dailyLoss', 'Günlük zarar limiti (%)', 0.5, 50, 0.5],
  ['maxLoss', 'Toplam zarar limiti (%)', 1, 90, 0.5],
  ['minDays', 'Asgari işlem günü', 0, 60, 1],
  ['split', 'Kâr payı (%)', 1, 100, 1],
  ['payoutMin', 'Ödeme eşiği (%)', 0.1, 50, 0.1],
];

export function Settings() {
  const settings = useApp((s) => s.settings);
  const save = useApp((s) => s.saveSettings);
  const [rules, setRules] = useState<Rules>(settings.rules);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(rules) !== JSON.stringify(settings.rules);

  const doExport = async () => {
    const blob = await exportBackup();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `s2c-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg('Yedek dosyası indirildi.');
  };
  const doImport = async (f: File) => {
    try {
      await importBackup(f);
      location.reload();
    } catch (e) {
      setMsg((e as Error).message || 'Yedek okunamadı.');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Ayarlar</h1>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Hesap kuralları</h2>
            <div className="grow" />
            <button className="btn sm ghost" onClick={() => setRules(DEFAULT_RULES)}>
              Varsayılan
            </button>
          </div>
          <div className="panel-body" style={{ display: 'grid', gap: 16 }}>
            <p className="muted">Yeni açılan hesaplar bu kuralları kullanır. Açık hesapların kuralları değişmez.</p>
            <div className="form-grid">
              {FIELDS.map(([k, label, min, max, step]) => (
                <label key={k} className="field">
                  <span>{label}</span>
                  <input
                    className="input"
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={rules[k] as number}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) setRules({ ...rules, [k]: Math.max(min, Math.min(max, v)) });
                    }}
                  />
                </label>
              ))}
            </div>
            <div>
              <button className="btn primary" disabled={!dirty} onClick={() => save({ rules })}>
                Kuralları kaydet
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Ses</h2>
          </div>
          <div className="panel-body" style={{ display: 'grid', gap: 16 }}>
            <label className="check">
              <input type="checkbox" checked={settings.sound} onChange={(e) => save({ sound: e.target.checked })} /> Sesler açık
            </label>
            <label className="field">
              <span>Ses seviyesi</span>
              <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => save({ volume: parseFloat(e.target.value) })} />
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.barTick} onChange={(e) => save({ barTick: e.target.checked })} /> Her yeni mumda hafif tık
            </label>
            <div className="field">
              <span>Dinle</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(
                  [
                    ['place', 'Emir verildi'],
                    ['fill', 'Emir doldu'],
                    ['tp', 'TP'],
                    ['sl', 'SL'],
                    ['warn', 'Kural uyarısı'],
                    ['violation', 'İhlal'],
                    ['funded', 'Fonlandı'],
                    ['payout', 'Ödeme'],
                    ['print', 'Seans raporu'],
                  ] as const
                ).map(([c, l]) => (
                  <button key={c} className="btn sm" onClick={() => play(c)}>
                    <Icon name="play" size={10} /> {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Yedekleme</h2>
          </div>
          <div className="panel-body" style={{ display: 'grid', gap: 16 }}>
            <p className="muted">
              Tüm veriler bu bilgisayarda, tarayıcının içinde saklanır. Tarayıcı verisi silinirse kaybolur; düzenli olarak yedek dosyası al.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={doExport}>
                <Icon name="download" size={16} /> Yedeği indir
              </button>
              <button className="btn" onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={16} /> Yedekten geri yükle
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setConfirmImport(f);
                  e.target.value = '';
                }}
              />
            </div>
            {confirmImport && (
              <div className="hint-line warn-c" style={{ alignItems: 'center' }}>
                <Icon name="warn" size={16} />
                <span style={{ flex: 1 }}>“{confirmImport.name}” yüklenirse mevcut tüm veriler bu yedekle değiştirilir.</span>
                <button className="btn sm ghost" onClick={() => setConfirmImport(null)}>
                  Vazgeç
                </button>
                <button className="btn sm primary" onClick={() => doImport(confirmImport)}>
                  Değiştir
                </button>
              </div>
            )}
            {msg && <div className="hint-line">{msg}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
