import { useRef, useState } from 'react';
import { useApp } from '../store';
import { DEFAULT_SPREAD } from '../lib/execution';
import { INSTRUMENTS } from '../lib/instruments';
import { exportBackup, importBackup, inspectBackup } from '../lib/db';
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
  const setups = useApp((s) => s.setups);
  const activeSetupId = useApp((s) => s.activeSetupId);
  const createSetup = useApp((s) => s.createSetup);
  const switchSetup = useApp((s) => s.switchSetup);
  const resetAllAccounts = useApp((s) => s.resetAllAccounts);
  const activeSetup = setups.find((x) => x.id === activeSetupId);
  const [rules, setRules] = useState<Rules>(settings.rules);
  const [setupName, setSetupName] = useState('');
  const [setupNote, setSetupNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState<{ file: File; accounts: number; trades: number; sessions: number } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
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
          <div className="panel-head"><h2>Çalışma setup'ı</h2></div>
          <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
            <p className="muted">Her setup hesaplarını, günlüğünü ve istatistiklerini ayrı tutar. Yeni setup açınca mevcut setup arşivlenir; verileri silinmez.</p>
            <label className="field">
              <span>Setup klasörleri</span>
              <select className="input" value={activeSetupId} onChange={(e) => void switchSetup(e.target.value)}>
                {setups.map((x) => <option key={x.id} value={x.id}>{x.name}{x.archivedAt ? ' · Arşiv' : ''}</option>)}
              </select>
            </label>
            {activeSetup?.note && <p className="muted">Not: {activeSetup.note}</p>}
            <div className="form-grid">
              <label className="field">
                <span>Yeni setup adı</span>
                <input className="input" maxLength={60} value={setupName} onChange={(e) => setSetupName(e.target.value)} placeholder="Ör. Londra açılışı" />
              </label>
              <label className="field">
                <span>Neden yeni setup açıyorsun?</span>
                <input className="input" maxLength={240} value={setupNote} onChange={(e) => setSetupNote(e.target.value)} placeholder="Kısa not veya değerlendirme" />
              </label>
            </div>
            <div><button className="btn primary" disabled={!setupName.trim()} onClick={() => void createSetup(setupName, setupNote)}>Mevcut setup'ı arşivle ve yenisini başlat</button></div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Veri kaynağı</h2></div>
          <div className="panel-body" style={{ display: 'grid', gap: 10 }}>
            <p><strong>Dukascopy · alış (bid) mumları</strong></p>
            <p className="muted">{INSTRUMENTS.map((i) => `${i.symbol} (${i.name})`).join(' · ')}. Kripto hafta sonu da işlem görür; altın ve endeksler Cuma 17:00 – Pazar 18:00 (New York) kapalıdır. Spread ayarı altın içindir; diğer enstrümanlar kendi varsayılan spread'ini kullanır.</p>
            <p className="muted">Geçmiş veriler bağlantı üzerinden alınır ve bilgisayarda önbelleğe kaydedilir. Mumlar alış (bid) fiyatıdır; long işlemler satış (ask) fiyatından açılır, short işlemler satış fiyatından kapanır. Kayma hesaba katılmaz.</p>
            <label className="field" style={{ maxWidth: 260 }}>
              <span>Altın spread (ask − bid, $)</span>
              <input
                className="input"
                type="number"
                min={0}
                max={5}
                step={0.05}
                value={settings.spread ?? DEFAULT_SPREAD}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) save({ spread: Math.max(0, Math.min(5, v)) });
                }}
              />
            </label>
            <p className="muted">Gerçek spread aracıya ve saate göre değişir; haber ve gün dönüşünde açılır. 0 yazarsan spread uygulanmaz.</p>
            <p className="muted">Takvim: NFP ve CPI geçmiş yayın tarihleri BLS arşivinden, FOMC tarihleri Fed takviminden alınır. NFP verileri Ocak 2023–Kasım 2026, CPI Ocak 2023–Ekim 2026, FOMC 2021–2026 ile sınırlıdır.</p>
          </div>
        </section>
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
                  if (f) {
                    setConfirmImport(null);
                    setMsg(null);
                    inspectBackup(f).then((data) => setConfirmImport({ file: f, accounts: data.accounts.length, trades: data.trades.length, sessions: data.sessions.length }))
                      .catch((e: Error) => setMsg(e.message));
                  }
                  e.target.value = '';
                }}
              />
            </div>
            {confirmImport && (
              <div className="hint-line warn-c" style={{ alignItems: 'center' }}>
                <Icon name="warn" size={16} />
                <span style={{ flex: 1 }}>“{confirmImport.file.name}”: {confirmImport.accounts} hesap, {confirmImport.trades} işlem, {confirmImport.sessions} seans. Yüklenirse mevcut tüm veriler değiştirilir. Önce mevcut yedeği indirmeni öneririz.</span>
                <button className="btn sm ghost" onClick={() => setConfirmImport(null)}>
                  Vazgeç
                </button>
                <button className="btn sm primary" onClick={() => doImport(confirmImport.file)}>
                  Değiştir
                </button>
              </div>
            )}
            {msg && <div className="hint-line">{msg}</div>}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Tüm hesapları sıfırla</h2></div>
          <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
            <p className="muted">Tüm çalışma alanlarındaki hesaplar, arşivdekiler dahil, ve bunlara ait işlem/seans geçmişi silinir. İndikatörler, grafik düzeni ve genel uygulama ayarları korunur.</p>
            {!confirmReset ? (
              <div><button className="btn" onClick={() => setConfirmReset(true)}>Tüm hesapları sıfırla…</button></div>
            ) : (
              <div className="hint-line warn-c" style={{ alignItems: 'center' }}>
                <Icon name="warn" size={16} />
                <span style={{ flex: 1 }}>Arşivdekiler dahil bütün hesaplar, işlemler, seanslar ve ekran görüntüleri kalıcı olarak silinecek. İndikatörlerin ve uygulama ayarların korunacak. Bu işlem geri alınamaz.</span>
                <button className="btn sm ghost" onClick={() => setConfirmReset(false)}>Vazgeç</button>
                <button className="btn sm primary" onClick={() => {
                  void resetAllAccounts().then(() => {
                    setConfirmReset(false);
                    setMsg('Tüm hesaplar ve hesap verileri silindi. İndikatörler ile uygulama ayarları korundu.');
                  }).catch((e: Error) => setMsg(e.message || 'Hesap verileri silinemedi.'));
                }}>Hepsini sil</button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
