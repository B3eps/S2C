import { useEffect, useState } from 'react';
import { useApp, View } from './store';
import { Emblem } from './components/Emblem';
import { Icon, IconName } from './components/Icon';
import { Dashboard } from './views/Dashboard';
import { NewAccount } from './views/NewAccount';
import { Trade } from './views/Trade';
import { Journal } from './views/Journal';
import { Stats } from './views/Stats';
import { Settings } from './views/Settings';
import { Replay } from './views/Replay';
import { Overlays, Notices } from './views/Overlays';

const NAV: [View, string, IconName][] = [
  ['dashboard', 'Panel', 'panel'],
  ['trade', 'İşlem', 'trade'],
  ['journal', 'Günlük', 'journal'],
  ['stats', 'İstatistik', 'stats'],
];

export function App() {
  const ready = useApp((s) => s.ready);
  const view = useApp((s) => s.view);
  const session = useApp((s) => s.session);
  const toast = useApp((s) => s.toast);
  const go = useApp((s) => s.go);

  const [bootError, setBootError] = useState(false);
  useEffect(() => {
    useApp.getState().boot().catch(() => setBootError(true));
  }, []);

  if (bootError) return <main className="loading"><div className="inner"><h1>Kayıtlar açılamadı</h1><p>Tarayıcının yerel depolama iznini ve boş alanı kontrol et.</p><button className="btn" onClick={() => location.reload()}>Tekrar dene</button></div></main>;
  if (!ready) return null;
  const current = view === 'new' ? 'dashboard' : view === 'replay' ? 'journal' : view;
  return (
    <div className="shell">
      <nav className="rail" aria-label="Ana menü">
        <button className="mark" onClick={() => go('dashboard')} style={{ border: 0, background: 'none', cursor: 'pointer' }} title="S2C">
          <Emblem width={52} />
        </button>
        {NAV.map(([v, label, icon]) => (
          <button key={v} className="rail-btn" aria-current={current === v ? 'page' : undefined} onClick={() => go(v)}>
            <Icon name={icon} />
            {label}
            {v === 'trade' && session && <span className="live-dot" title="Açık seans" />}
          </button>
        ))}
        <div className="spacer" />
        <button className="rail-btn" aria-current={current === 'settings' ? 'page' : undefined} onClick={() => go('settings')}>
          <Icon name="settings" />
          Ayarlar
        </button>
      </nav>
      <main className="main">
        {view === 'dashboard' && <Dashboard />}
        {view === 'new' && <NewAccount />}
        {view === 'trade' && <Trade />}
        {view === 'journal' && <Journal />}
        {view === 'stats' && <Stats />}
        {view === 'settings' && <Settings />}
        {view === 'replay' && <Replay />}
      </main>
      <Overlays />
      <Notices />
      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          {toast.tone !== 'neutral' && <Icon name="warn" size={16} />}
          {toast.text}
        </div>
      )}
    </div>
  );
}
