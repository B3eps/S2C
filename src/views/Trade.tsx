import { useEffect, useState } from 'react';
import { useApp, SPEEDS, ticketLots, riskOf, pnlOf, accountLimits } from '../store';
import { ChartPanel } from '../components/ChartPanel';
import { CertLabel, CountUp, RuleGauges } from '../components/bits';
import { Icon } from '../components/Icon';
import { marketSession } from '../lib/calendar';
import { clockUtc, lots as fmtLots, money, money0, rMult, signedMoney } from '../lib/format';
import { C } from '../lib/theme';

export function Trade() {
  const session = useApp((s) => s.session);
  const loading = useApp((s) => s.loading);
  const prefs = useApp((s) => s.prefs);

  // Space reveals the next bar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select,button')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!useApp.getState().playing) useApp.getState().stepBar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading || !session) return <Loading />;
  return (
    <div className="trade">
      <TopBar />
      <div className="trade-body">
        <Tools />
        <div className={`charts ${prefs.layout === 'dual' ? 'dual' : ''}`}>
          <ChartPanel slot="a" primary />
          {prefs.layout === 'dual' && <ChartPanel slot="b" primary={false} />}
        </div>
        <OrderPanel />
      </div>
      <Dock />
    </div>
  );
}

function Loading() {
  const loading = useApp((s) => s.loading);
  const session = useApp((s) => s.session);
  const go = useApp((s) => s.go);
  if (!loading && !session)
    return (
      <div className="loading">
        <div className="inner">
          <h1>Açık seans yok</h1>
          <p>Panelden bir hesap seçip seansı başlat.</p>
          <button className="btn primary" onClick={() => go('dashboard')}>
            Panele dön
          </button>
        </div>
      </div>
    );
  return (
    <div className="loading">
      <div className="inner">
        {loading?.error ? (
          <>
            <Icon name="warn" size={24} style={{ color: C.warn }} />
            <p>{loading.error}</p>
            <button className="btn" onClick={() => go('dashboard')}>
              Panele dön
            </button>
          </>
        ) : (
          <>
            <p>Geçmişten rastgele bir an seçiliyor. Fiyat ve tarih gizli kalacak.</p>
            <div className="bar">
              <i style={{ width: `${Math.round((loading?.progress ?? 0) * 100)}%` }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TopBar() {
  const session = useApp((s) => s.session)!;
  const account = useApp((s) => s.accounts.find((a) => a.id === s.session?.accountId));
  const live = useApp((s) => s.live);
  const endSession = useApp((s) => s.endSession);
  const [confirm, setConfirm] = useState(false);
  if (!account) return null;
  const ms = marketSession(live.clock - 60_000);
  return (
    <div className="topbar">
      <CertLabel a={account} compact />
      <div className="figures">
        <div className="figure">
          <span className="k">Bakiye</span>
          <CountUp className="v" value={account.balance} format={money} />
        </div>
        <div className="figure">
          <span className="k">Varlık</span>
          <CountUp className="v" value={live.equity} format={money} />
        </div>
        <div className="figure">
          <span className="k">Açık K/Z</span>
          <CountUp className={`v ${live.floating > 0 ? 'up' : live.floating < 0 ? 'down' : ''}`} value={live.floating} format={signedMoney} />
        </div>
      </div>
      <div className="gauges">
        <RuleGauges a={account} s={session} equity={live.equity} />
      </div>
      <div className="clock" title="Tarih gizli. Saat UTC.">
        <Icon name="clock" size={16} />
        <span>{ms.name}</span>
        <b>{clockUtc(live.clock - 60_000)}</b>
      </div>
      {confirm ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn sm ghost" onClick={() => setConfirm(false)}>
            Vazgeç
          </button>
          <button className="btn sm primary" onClick={() => endSession('user')}>
            {session.positions.length ? 'Kapat ve bitir' : 'Bitir'}
          </button>
        </div>
      ) : (
        <button className="btn" onClick={() => setConfirm(true)}>
          <Icon name="flag" size={16} /> Seansı bitir
        </button>
      )}
    </div>
  );
}

function Tools() {
  const tool = useApp((s) => s.tool);
  const setTool = useApp((s) => s.setTool);
  const clearDrawings = useApp((s) => s.clearDrawings);
  const prefs = useApp((s) => s.prefs);
  const setPrefs = useApp((s) => s.setPrefs);
  const settings = useApp((s) => s.settings);
  const saveSettings = useApp((s) => s.saveSettings);
  const n = useApp((s) => s.session?.drawings.length ?? 0);
  return (
    <div className="tools">
      <button className="icon-btn" aria-pressed={tool === 'cursor'} title="İmleç" onClick={() => setTool('cursor')}>
        <Icon name="cursor" />
      </button>
      <button className="icon-btn" aria-pressed={tool === 'trend'} title="Trend çizgisi" onClick={() => setTool('trend')}>
        <Icon name="trend" />
      </button>
      <button className="icon-btn" aria-pressed={tool === 'hline'} title="Yatay seviye" onClick={() => setTool('hline')}>
        <Icon name="hline" />
      </button>
      <button className="icon-btn" aria-pressed={tool === 'rect'} title="Kutu" onClick={() => setTool('rect')}>
        <Icon name="rect" />
      </button>
      <button className="icon-btn" title="Tüm çizimleri sil" disabled={!n} onClick={clearDrawings} style={{ opacity: n ? 1 : 0.4 }}>
        <Icon name="trash" />
      </button>
      <hr />
      <button className="icon-btn" aria-pressed={prefs.layout === 'single'} title="Tek grafik" onClick={() => setPrefs({ layout: 'single' })}>
        <Icon name="single" />
      </button>
      <button className="icon-btn" aria-pressed={prefs.layout === 'dual'} title="İki zaman dilimi" onClick={() => setPrefs({ layout: 'dual' })}>
        <Icon name="dual" />
      </button>
      <hr />
      <button className="icon-btn" title={settings.sound ? 'Sesi kapat' : 'Sesi aç'} onClick={() => saveSettings({ sound: !settings.sound })}>
        <Icon name={settings.sound ? 'soundOn' : 'soundOff'} />
      </button>
    </div>
  );
}

function OrderPanel() {
  const ticket = useApp((s) => s.ticket);
  const account = useApp((s) => s.accounts.find((a) => a.id === s.session?.accountId));
  const session = useApp((s) => s.session);
  const live = useApp((s) => s.live);
  const S = useApp.getState;
  if (!account || !session) return <div className="order" />;
  const lim = accountLimits(account, session);

  const side = ticket?.side;
  const entry = ticket ? (ticket.type === 'market' ? live.price : ticket.entry) : 0;
  const l = ticket ? ticketLots(ticket, account.balance, entry) : 0;
  const risk = ticket ? riskOf(entry, ticket.sl, l) : undefined;
  const reward = ticket && ticket.tp !== undefined ? Math.abs(pnlOf(ticket.side, entry, ticket.tp, l)) : undefined;
  const rr = risk && reward ? reward / risk : undefined;
  const riskPctAcc = risk ? (risk / account.balance) * 100 : undefined;
  const dayRoom = session.dayStartEquity - lim.dayFloor - Math.max(0, session.dayStartEquity - live.equity);
  const tooBig = risk !== undefined && risk > dayRoom;

  return (
    <aside className="order" aria-label="Emir">
      <div className="order-sec">
        <div className="side-pick">
          <button className="side-btn long" aria-pressed={side === 'long'} onClick={() => (ticket ? S().updateTicket({ side: 'long' }) : S().openTicket('long'))}>
            LONG
            <small>Al</small>
          </button>
          <button className="side-btn short" aria-pressed={side === 'short'} onClick={() => (ticket ? S().updateTicket({ side: 'short' }) : S().openTicket('short'))}>
            SHORT
            <small>Sat</small>
          </button>
        </div>
        {!ticket && (
          <div className="hint-line">
            <Icon name="cursor" size={14} style={{ marginTop: 1 }} />
            <span>Limit ve stop emri için grafikte seviyeye sağ tıkla.</span>
          </div>
        )}
      </div>

      {ticket && (
        <>
          <div className="order-sec">
            <div className="seg" role="group" aria-label="Emir tipi" style={{ width: '100%' }}>
              <button style={{ flex: 1 }} aria-pressed={ticket.type === 'market'} onClick={() => S().updateTicket({ type: 'market' })}>
                Piyasa
              </button>
              <button
                style={{ flex: 1 }}
                aria-pressed={ticket.type !== 'market'}
                onClick={() => {
                  if (ticket.type === 'market') {
                    const off = Math.abs((ticket.sl ?? entry) - entry) * 0.5 || entry * 0.001;
                    const e = ticket.side === 'long' ? entry - off : entry + off;
                    S().openTicket(ticket.side, 'limit', e);
                  }
                }}
              >
                Bekleyen {ticket.type !== 'market' ? `· ${ticket.type === 'limit' ? 'limit' : 'stop'}` : ''}
              </button>
            </div>
            {ticket.type !== 'market' && <div className="hint-line">Giriş çizgisini grafikte sürükle. Fiyatın altında long limit, üstünde long stop olur (short için tersi).</div>}
            <div className="level-toggles">
              <label className="check">
                <input type="checkbox" checked={ticket.sl !== undefined} onChange={() => S().toggleTicketLevel('sl')} />
                Zarar durdur (SL)
              </label>
              <label className="check">
                <input type="checkbox" checked={ticket.tp !== undefined} onChange={() => S().toggleTicketLevel('tp')} />
                Kâr al (TP)
              </label>
            </div>
          </div>

          <div className="order-sec">
            <label className="check" style={{ opacity: ticket.sl === undefined ? 0.5 : 1 }}>
              <input type="checkbox" checked={ticket.useRisk && ticket.sl !== undefined} disabled={ticket.sl === undefined} onChange={(e) => S().updateTicket({ useRisk: e.target.checked })} />
              Lotu riske göre hesapla
            </label>
            {ticket.useRisk && ticket.sl !== undefined ? (
              <>
                <div className="field">
                  <span>İşlem başına risk (hesabın %)</span>
                  <div className="preset-row">
                    {[0.25, 0.5, 1, 2].map((p) => (
                      <button key={p} aria-pressed={ticket.riskPct === p} onClick={() => S().updateTicket({ riskPct: p })}>
                        %{String(p).replace('.', ',')}
                      </button>
                    ))}
                  </div>
                  <input
                    className="input"
                    type="number"
                    step={0.05}
                    min={0.05}
                    max={10}
                    value={ticket.riskPct}
                    onChange={(e) => S().updateTicket({ riskPct: Math.max(0.05, Math.min(10, parseFloat(e.target.value) || 0.05)) })}
                  />
                </div>
              </>
            ) : (
              <label className="field">
                <span>Lot{ticket.sl === undefined ? ' (SL olmadan lotu sen seçersin)' : ''}</span>
                <input
                  className="input"
                  type="number"
                  step={0.01}
                  min={0.01}
                  value={ticket.manualLots}
                  onChange={(e) => S().updateTicket({ manualLots: Math.max(0.01, parseFloat(e.target.value) || 0.01) })}
                />
              </label>
            )}
          </div>

          <div className="order-sec">
            <dl className="kv">
              <dt>Lot</dt>
              <dd>{fmtLots(l)}</dd>
              <dt>Risk</dt>
              <dd className={tooBig ? 'down' : ''}>{risk !== undefined ? `${money(risk)} · %${riskPctAcc!.toFixed(2).replace('.', ',')}` : 'Sınırsız (SL yok)'}</dd>
              <dt>Hedef kazanç</dt>
              <dd>{reward !== undefined ? money(reward) : '—'}</dd>
              <dt>Risk / ödül</dt>
              <dd>{rr ? `1 : ${rr.toFixed(2).replace('.', ',')}` : '—'}</dd>
            </dl>
            {rr && (
              <div className="rr-bar" aria-hidden="true">
                <i style={{ flex: 1, background: C.down }} />
                <i style={{ flex: Math.min(rr, 6), background: C.up }} />
              </div>
            )}
            {tooBig && <div className="hint-line down">Bu risk, bugünkü kalan zarar payını ({money(Math.max(0, dayRoom))}) aşıyor.</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
              <button className="btn" onClick={() => S().cancelTicket()}>
                İptal
              </button>
              <button className={`btn primary`} onClick={() => S().submitTicket()}>
                {ticket.type === 'market' ? `${ticket.side === 'long' ? 'Long' : 'Short'} aç` : 'Emri yerleştir'}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="order-sec" style={{ borderBottom: 0 }}>
        <h2 style={{ fontSize: 'var(--t-12)', color: 'var(--ink-3)', fontWeight: 500 }}>
          {account.phase === 'challenge' ? 'Değerlendirme kuralları' : 'Fonlu hesap kuralları'}
        </h2>
        <dl className="kv">
          <dt>Günlük zarar limiti</dt>
          <dd>
            %{account.rules.dailyLoss} · {money0((account.size * account.rules.dailyLoss) / 100)}
          </dd>
          <dt>Toplam zarar limiti</dt>
          <dd>
            %{account.rules.maxLoss} · alt sınır {money0(lim.maxFloor)}
          </dd>
          {account.phase === 'challenge' ? (
            <>
              <dt>Kâr hedefi</dt>
              <dd>
                %{account.rules.target} · {money0(lim.target)}
              </dd>
              <dt>Asgari işlem günü</dt>
              <dd>
                {new Set(account.tradingDays).size} / {account.rules.minDays}
              </dd>
            </>
          ) : (
            <>
              <dt>Ödeme eşiği</dt>
              <dd>
                %{account.rules.payoutMin} · {money0(lim.payoutAt)}
              </dd>
              <dt>Kâr payın</dt>
              <dd>%{account.rules.split}</dd>
              <dt>Ödeme şartı</dt>
              <dd>açık pozisyon yok</dd>
            </>
          )}
        </dl>
        {account.phase === 'funded' && <div className="hint-line">Fonlu hesapta zarar limitleri aynen geçerli. Aşılırsa hesap kapanır.</div>}
        {account.phase === 'funded' && (
          <button className="btn" disabled={account.balance < lim.payoutAt || session.positions.length > 0} onClick={() => S().requestPayout(account.id)}>
            <Icon name="coin" size={16} /> Ödeme iste
          </button>
        )}
      </div>
    </aside>
  );
}

function Dock() {
  const [tab, setTab] = useState<'pos' | 'orders' | 'history'>('pos');
  const session = useApp((s) => s.session)!;
  const sessionTrades = useApp((s) => s.sessionTrades);
  const playing = useApp((s) => s.playing);
  const dataWait = useApp((s) => s.dataWait);
  const prefs = useApp((s) => s.prefs);
  const live = useApp((s) => s.live);
  const S = useApp.getState;
  return (
    <div className="dock">
      <div className="replay-bar">
        <button className={`play ${playing ? 'on' : ''}`} title={playing ? 'Duraklat' : 'Oynat'} onClick={() => S().setPlaying(!playing)}>
          <Icon name={playing ? 'pause' : 'play'} size={16} />
        </button>
        <button className="btn sm" onClick={() => S().stepBar()} disabled={playing} title="Sonraki mum (Boşluk)">
          <Icon name="step" size={14} /> Sonraki mum <span className="kbd">Boşluk</span>
        </button>
        <div className="seg" role="group" aria-label="Hız" style={{ marginLeft: 8 }}>
          {SPEEDS.map((sp, i) => (
            <button key={sp} aria-pressed={prefs.speed === i} onClick={() => S().setPrefs({ speed: i })} title={`Saniyede ${sp} mum`}>
              {sp}×
            </button>
          ))}
        </div>
        {dataWait && (
          <span className="wait">
            <span className="spin" /> Veri yükleniyor
          </span>
        )}
        <div className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={tab === 'pos'} onClick={() => setTab('pos')}>
            Pozisyonlar <span className="count">{session.positions.length}</span>
          </button>
          <button className="tab" role="tab" aria-selected={tab === 'orders'} onClick={() => setTab('orders')}>
            Bekleyen emirler <span className="count">{session.orders.length}</span>
          </button>
          <button className="tab" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>
            Seans geçmişi <span className="count">{sessionTrades.length}</span>
          </button>
        </div>
      </div>
      <div className="dock-body">
        {tab === 'pos' &&
          (session.positions.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Yön</th>
                  <th className="r">Lot</th>
                  <th className="r">SL</th>
                  <th className="r">TP</th>
                  <th className="r">Risk</th>
                  <th className="r">Açık K/Z</th>
                  <th className="r">R</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {session.positions.map((p) => {
                  const fl = pnlOf(p.side, p.entry, live.price, p.lots);
                  const risk = riskOf(p.entry, p.initialSl, p.lots);
                  const slR = p.sl !== undefined && risk ? pnlOf(p.side, p.entry, p.sl, p.lots) / risk : undefined;
                  const tpR = p.tp !== undefined && risk ? pnlOf(p.side, p.entry, p.tp, p.lots) / risk : undefined;
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className={`side-tag ${p.side}`}>
                          <Icon name={p.side === 'long' ? 'up' : 'down'} size={14} /> {p.side === 'long' ? 'Long' : 'Short'}
                        </span>
                      </td>
                      <td className="r">{fmtLots(p.lots)}</td>
                      <td className="r">{p.sl === undefined ? <span className="muted">yok</span> : rMult(slR)}</td>
                      <td className="r">{p.tp === undefined ? <span className="muted">yok</span> : rMult(tpR)}</td>
                      <td className="r">{risk ? money(risk) : '—'}</td>
                      <td className={`r ${fl > 0 ? 'up' : fl < 0 ? 'down' : ''}`}>{signedMoney(fl)}</td>
                      <td className="r">{risk ? rMult(fl / risk) : '—'}</td>
                      <td className="r">
                        <button className="btn sm" onClick={() => S().closePosition(p.id)}>
                          Kapat
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty">Açık pozisyon yok. Sağdaki panelden Long ya da Short ile başla.</div>
          ))}
        {tab === 'orders' &&
          (session.orders.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Yön</th>
                  <th>Tip</th>
                  <th className="r">Lot</th>
                  <th className="r">Fiyata uzaklık</th>
                  <th className="r">SL</th>
                  <th className="r">TP</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {session.orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <span className={`side-tag ${o.side}`}>
                        <Icon name={o.side === 'long' ? 'up' : 'down'} size={14} /> {o.side === 'long' ? 'Long' : 'Short'}
                      </span>
                    </td>
                    <td>{o.type === 'limit' ? 'Limit' : 'Stop'}</td>
                    <td className="r">{fmtLots(o.lots)}</td>
                    <td className="r">%{((Math.abs(o.price - live.price) / live.price) * 100).toFixed(3).replace('.', ',')}</td>
                    <td className="r">{o.sl === undefined ? <span className="muted">yok</span> : 'var'}</td>
                    <td className="r">{o.tp === undefined ? <span className="muted">yok</span> : 'var'}</td>
                    <td className="r">
                      <button className="btn sm" onClick={() => S().cancelOrder(o.id)}>
                        İptal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Bekleyen emir yok. Grafikte bir seviyeye sağ tıklayarak limit ya da stop emri ver.</div>
          ))}
        {tab === 'history' &&
          (sessionTrades.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Yön</th>
                  <th>Tip</th>
                  <th className="r">Lot</th>
                  <th>Çıkış</th>
                  <th className="r">K/Z</th>
                  <th className="r">R</th>
                </tr>
              </thead>
              <tbody>
                {[...sessionTrades].reverse().map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className={`side-tag ${t.side}`}>
                        <Icon name={t.side === 'long' ? 'up' : 'down'} size={14} /> {t.side === 'long' ? 'Long' : 'Short'}
                      </span>
                    </td>
                    <td>{t.orderType === 'market' ? 'Piyasa' : t.orderType === 'limit' ? 'Limit' : 'Stop'}</td>
                    <td className="r">{fmtLots(t.lots)}</td>
                    <td>{REASON[t.reason]}</td>
                    <td className={`r ${t.pnl > 0 ? 'up' : t.pnl < 0 ? 'down' : ''}`}>{signedMoney(t.pnl)}</td>
                    <td className="r">{rMult(t.r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Bu seansta kapanmış işlem yok.</div>
          ))}
      </div>
    </div>
  );
}

export const REASON = { tp: 'Hedef (TP)', sl: 'Zarar durdur (SL)', manual: 'Elle kapatıldı', session: 'Seans sonu', violation: 'Kural ihlali' } as const;
