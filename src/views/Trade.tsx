import { useEffect, useState } from 'react';
import { splitFor } from '../lib/programs';
import { commissionFor } from '../lib/instruments';
import { activeInstrument, useApp, SPEEDS, ticketLots, riskOf, pnlOf, markPrice, spreadOf, accountLimits, countedDays, passBlocker, payoutBlocker, consistencyScore } from '../store';
import { isParcaId } from '../lib/parcaVariants';
import { ChartPanel } from '../components/ChartPanel';
import { ToolRail, GRID } from '../components/ToolRail';
import { CertLabel, CountUp, RuleGauges } from '../components/bits';
import { Icon } from '../components/Icon';
import { marketSession } from '../lib/calendar';
import { clockUtc, lots as fmtLots, money, money0, rMult, signedMoney } from '../lib/format';
import { C } from '../lib/theme';

export function Trade() {
  const session = useApp((s) => s.session);
  const loading = useApp((s) => s.loading);
  const prefs = useApp((s) => s.prefs);
  const maxPane = useApp((s) => s.maxPane);
  const orderOpen = prefs.orderOpen !== false;
  const dockOpen = prefs.dockOpen !== false;
  const orderW = Math.max(260, Math.min(prefs.orderW ?? 304, 520));
  const dockH = Math.max(120, Math.min(prefs.dockH ?? 232, 520, Math.round(window.innerHeight * 0.5)));
  const [cols, rows] = maxPane !== null && maxPane < prefs.count ? [1, 1] : GRID[prefs.count] ?? [1, 1];

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
    <div className="trade" style={{ gridTemplateRows: `56px minmax(0, 1fr) ${dockOpen ? dockH : 44}px` }}>
      <TopBar />
      <div className="trade-body" style={{ gridTemplateColumns: `48px minmax(0, 1fr) ${orderOpen ? orderW + 'px' : '28px'}` }}>
        <ToolRail />
        <div className="charts grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
          {Array.from({ length: prefs.count }, (_, i) => (
            <div key={i} className="chart-slot" hidden={maxPane !== null && maxPane < prefs.count && maxPane !== i}>
              <ChartPanel index={i} />
            </div>
          ))}
        </div>
        {orderOpen ? <OrderPanel /> : <OrderFold />}
      </div>
      <Dock />
    </div>
  );
}

function OrderFold() {
  return (
    <aside className="order folded" aria-label="Emir paneli kapalı">
      <button className="icon-btn sm" title="Emir panelini aç" onClick={() => useApp.getState().setPrefs({ orderOpen: true })}>
        <Icon name="chevron" size={14} style={{ transform: 'rotate(90deg)' }} />
      </button>
      <span className="fold-label">Emir</span>
    </aside>
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
            {loading.accountId && <button className="btn primary" onClick={() => useApp.getState().startSession(loading.accountId!)}>Tekrar dene</button>}
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
          <button className="btn sm primary" title="Seansı mevcut fiyatla kapatır; günlük limit saatini ileri sarmaz." onClick={() => endSession('user')}>
            {session.positions.length ? 'Pozisyonları kapat ve seansı kapat' : 'Seansı kapat'}
          </button>
        </div>
      ) : (
        <button className="btn" title="Seansı mevcut fiyatla kapatır; gün sonuna ilerlemek için alttaki düğmeyi kullan." onClick={() => setConfirm(true)}>
          <Icon name="flag" size={16} /> Seansı bitir
        </button>
      )}
    </div>
  );
}

function OrderPanel() {
  const ticket = useApp((s) => s.ticket);
  const account = useApp((s) => s.accounts.find((a) => a.id === s.session?.accountId));
  const session = useApp((s) => s.session);
  const live = useApp((s) => s.live);
  const S = useApp.getState;
  const editing = useApp((s) => s.editing);
  if (!account || !session) return <div className="order" />;
  const lim = accountLimits(account, session);
  const prefs = useApp((s) => s.prefs);
  const edited = editing ? (editing.kind === 'order' ? session.orders.find((o) => o.id === editing.id) : session.positions.find((p) => p.id === editing.id)) : undefined;

  const side = ticket?.side;
  const entry = ticket ? (ticket.type === 'market' ? live.price : ticket.entry) : 0;
  const l = ticket ? ticketLots(ticket, account.balance, entry) : 0;
  const risk = ticket ? riskOf(entry, ticket.sl, l) : undefined;
  const reward = ticket && ticket.tp !== undefined ? Math.abs(pnlOf(ticket.side, entry, ticket.tp, l)) : undefined;
  const rr = risk && reward ? reward / risk : undefined;
  const riskPctAcc = risk !== undefined ? (risk / account.balance) * 100 : undefined;
  const dayRoom = session.dayStartEquity - lim.dayFloor - Math.max(0, session.dayStartEquity - live.equity);
  const tooBig = risk !== undefined && risk > dayRoom;

  return (
    <aside className="order" aria-label="Emir">
      <div
        className="order-grip"
        title="Genişliği ayarlamak için sürükle"
        onPointerDown={(e) => {
          e.preventDefault();
          const x0 = e.clientX;
          const w0 = prefs.orderW ?? 304;
          const el = e.currentTarget;
          el.setPointerCapture(e.pointerId);
          const move = (ev: PointerEvent) => S().setPrefs({ orderW: Math.max(260, Math.min(520, w0 + (x0 - ev.clientX))) });
          const up = () => {
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', up);
          };
          el.addEventListener('pointermove', move);
          el.addEventListener('pointerup', up);
        }}
      />
      <button className="order-fold icon-btn sm" title="Emir panelini kapat" onClick={() => S().setPrefs({ orderOpen: false })}>
        <Icon name="chevron" size={14} style={{ transform: 'rotate(-90deg)' }} />
      </button>
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

      {edited && editing && <EditPanel kind={editing.kind} id={editing.id} />}

      {ticket && !edited && (
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
            {l < 0.01 && <div className="hint-line down">0,01 lot seçilen risk bütçesini aşıyor.</div>}
            {tooBig && <div className="hint-line down">Bu risk, bugünkü kalan zarar payını ({money(Math.max(0, dayRoom))}) aşıyor.</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
              <button className="btn" onClick={() => S().cancelTicket()}>
                İptal
              </button>
              <button className={`btn primary`} disabled={l < 0.01} onClick={() => S().submitTicket()}>
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
            %{String(account.rules.dailyLoss).replace('.', ',')} · {money0((account.size * account.rules.dailyLoss) / 100)}
          </dd>
          <dt>Gün başı (22:00 UTC)</dt>
          <dd>{account.rules.dailyBase === 'balance' ? 'bakiye' : 'bakiye/varlık yüksek olan'}</dd>
          <dt>Toplam zarar limiti</dt>
          <dd>
            %{account.rules.maxLoss} {account.rules.maxType === 'trailing' ? 'takip eden' : 'sabit'} · alt sınır {money0(lim.maxFloor)}
          </dd>
          {!!account.rules.consistencyPct && account.phase === 'challenge' && (
            <>
              <dt>Tutarlılık (en iyi gün)</dt>
              <dd>
                %{consistencyScore(account).toFixed(0)} / %{account.rules.consistencyPct}
              </dd>
            </>
          )}
          {account.phase === 'challenge' ? (
            <>
              <dt>{lim.steps > 1 ? `Aşama ${lim.step + 1}/${lim.steps} hedefi` : 'Kâr hedefi'}</dt>
              <dd>
                %{String(lim.targetPct).replace('.', ',')} · {money0(lim.target)}
              </dd>
              <dt>{account.rules.minDayPct ? 'Kârlı gün' : 'İşlem günü'}</dt>
              <dd>
                {countedDays(account)} / {account.rules.minDays}
              </dd>
            </>
          ) : (
            <>
              <dt>Ödeme eşiği</dt>
              <dd>
                %{account.rules.payoutMin} · {money0(lim.payoutAt)}
              </dd>
              <dt>Kâr payın</dt>
              <dd>%{splitFor(account.rules, account.payouts.length)}</dd>
              {!!account.rules.payoutConsistencyPct && (
                <>
                  <dt>Ödeme tutarlılığı</dt>
                  <dd>
                    %{consistencyScore(account).toFixed(0)} / %{account.rules.payoutConsistencyPct}
                  </dd>
                </>
              )}
              {!!account.rules.payoutMinDays && (
                <>
                  <dt>Ödeme öncesi işlem günü</dt>
                  <dd>
                    {new Set(account.payoutDays ?? []).size} / {account.rules.payoutMinDays}
                  </dd>
                </>
              )}
              {lim.buffer > 0 && (
                <>
                  <dt>Hesapta kalan tampon</dt>
                  <dd>{money0(lim.buffer)}</dd>
                </>
              )}
            </>
          )}
        </dl>
        {account.phase === 'funded' && <div className="hint-line">Fonlu hesapta zarar limitleri aynen geçerli. Aşılırsa hesap kapanır.</div>}
        {passBlocker(account, session.positions.length) && <div className="hint-line warn-c">{passBlocker(account, session.positions.length)}</div>}
        {!!commissionFor(account.rules, activeInstrument()) && <div className="hint-line">Komisyon %{String(commissionFor(account.rules, activeInstrument())).replace('.', ',')} / yön, kâr ve zarara dahil.</div>}
        {account.phase === 'funded' && (
          <button className="btn" disabled={!!payoutBlocker(account, session.positions.length)} title={payoutBlocker(account, session.positions.length) ?? undefined} onClick={() => S().requestPayout(account.id)}>
            <Icon name="coin" size={16} /> Ödeme iste
          </button>
        )}
      </div>
    </aside>
  );
}


/** Edit a placed order or an open position: size, SL/TP on or off, cancel/close. Prices move by dragging on the chart. */
function EditPanel({ kind, id }: { kind: 'order' | 'pos'; id: string }) {
  const session = useApp((s) => s.session)!;
  const account = useApp((s) => s.accounts.find((a) => a.id === s.session?.accountId))!;
  const live = useApp((s) => s.live);
  const S = useApp.getState;
  const o = kind === 'order' ? session.orders.find((x) => x.id === id) : undefined;
  const p = kind === 'pos' ? session.positions.find((x) => x.id === id) : undefined;
  const h = o ?? p;
  if (!h) return null;
  const entry = o ? o.price : p!.entry;
  const lotsNow = h.lots;
  const riskSl = p ? p.initialSl ?? p.sl : o!.sl;
  const risk = riskOf(entry, riskSl, lotsNow);
  const reward = h.tp !== undefined ? Math.abs(pnlOf(h.side, entry, h.tp, lotsNow)) : undefined;
  const rr = risk && reward ? reward / risk : undefined;
  const target = { kind, id } as const;
  const toggle = (field: 'sl' | 'tp') => {
    if (h[field] !== undefined) S().clearLevel({ ...target, field });
    else {
      S().placeLevel({ ...target, field });
      S().commitLine();
    }
  };
  const sideName = h.side === 'long' ? 'Long' : 'Short';
  return (
    <>
      <div className="order-sec">
        <div className="edit-head">
          <span className={`side-tag ${h.side}`}>
            <Icon name={h.side === 'long' ? 'up' : 'down'} size={16} />
          </span>
          <h2>{o ? `${sideName} ${o.type === 'limit' ? 'limit' : 'stop'} emri` : `${sideName} pozisyon`}</h2>
          <button className="icon-btn sm" title="Kapat" onClick={() => S().selectLine(null)}>
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="hint-line">Giriş, SL ve TP çizgilerini grafikte sürükleyerek fiyatlarını değiştir.</div>
      </div>
      <div className="order-sec">
        <div className="level-toggles">
          <label className="check">
            <input type="checkbox" checked={h.sl !== undefined} onChange={() => toggle('sl')} />
            Zarar durdur (SL)
          </label>
          <label className="check">
            <input type="checkbox" checked={h.tp !== undefined} onChange={() => toggle('tp')} />
            Kâr al (TP)
          </label>
        </div>
        {o ? (
          <>
            <label className="field">
              <span>Lot</span>
              <input
                className="input"
                type="number"
                step={0.01}
                min={0.01}
                value={o.lots}
                onChange={(e) => S().setOrderLots(o.id, Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                onBlur={() => S().commitLine()}
              />
            </label>
            {o.sl !== undefined && (
              <div className="field">
                <span>Lotu riske göre ayarla (hesabın %)</span>
                <div className="preset-row">
                  {[0.25, 0.5, 1, 2].map((pc) => (
                    <button
                      key={pc}
                      onClick={() => {
                        S().setOrderLots(o.id, (account.balance * pc) / 100 / (Math.abs(o.price - o.sl!) * 100));
                        S().commitLine();
                      }}
                    >
                      %{String(pc).replace('.', ',')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <dl className="kv">
            <dt>Lot</dt>
            <dd>{fmtLots(p!.lots)}</dd>
            <dt>Açık K/Z</dt>
            <dd className={pnlOf(p!.side, p!.entry, markPrice(p!.side, live.price, spreadOf(useApp.getState().settings)), p!.lots) >= 0 ? 'up' : 'down'}>{signedMoney(pnlOf(p!.side, p!.entry, markPrice(p!.side, live.price, spreadOf(useApp.getState().settings)), p!.lots))}</dd>
          </dl>
        )}
      </div>
      <div className="order-sec">
        <dl className="kv">
          <dt>Risk</dt>
          <dd>{risk !== undefined ? `${money(risk)} · %${((risk / account.balance) * 100).toFixed(2).replace('.', ',')}` : 'Sınırsız (SL yok)'}</dd>
          <dt>Hedef kazanç</dt>
          <dd>{reward !== undefined ? money(reward) : '—'}</dd>
          <dt>Risk / ödül</dt>
          <dd>{rr ? `1 : ${rr.toFixed(2).replace('.', ',')}` : '—'}</dd>
        </dl>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="btn" onClick={() => S().selectLine(null)}>
            Bitti
          </button>
          {o ? (
            <button className="btn danger" onClick={() => S().cancelOrder(o.id)}>
              Emri sil
            </button>
          ) : (
            <button className="btn danger" onClick={() => S().closePosition(p!.id)}>
              Pozisyonu kapat
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function Dock() {
  const [tab, setTab] = useState<'pos' | 'orders' | 'history'>('pos');
  const session = useApp((s) => s.session)!;
  const sessionTrades = useApp((s) => s.sessionTrades);
  const playing = useApp((s) => s.playing);
  const seekingSignal = useApp((s) => s.seekingSignal);
  const dataWait = useApp((s) => s.dataWait);
  const prefs = useApp((s) => s.prefs);
  const live = useApp((s) => s.live);
  const editing = useApp((s) => s.editing);
  const S = useApp.getState;
  const oneMinute = prefs.panes[0].tf === '1m';
  const hasSetup = prefs.panes.slice(0, prefs.count).some((pane) => pane.ind.some((ind) => isParcaId(ind.id) && !ind.hidden));
  const open = prefs.dockOpen !== false;
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = prefs.dockH ?? 232;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const h = Math.max(120, Math.min(520, h0 + (y0 - ev.clientY)));
      S().setPrefs({ dockH: h, dockOpen: true });
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };
  return (
    <div className={`dock ${open ? '' : 'folded'}`}>
      <div className="dock-grip" onPointerDown={startResize} onDoubleClick={() => S().setPrefs({ dockOpen: !open })} title="Yüksekliği ayarlamak için sürükle, katlamak için çift tıkla" />
      <div className="replay-bar">
        <button className={`play ${playing ? 'on' : ''}`} title={playing ? 'Duraklat' : 'Oynat'} disabled={seekingSignal} onClick={() => S().setPlaying(!playing)}>
          <Icon name={playing ? 'pause' : 'play'} size={16} />
        </button>
        <button className="btn sm" onClick={() => S().stepBar()} disabled={playing || seekingSignal} title="Sonraki mum (Boşluk)">
          <Icon name="step" size={14} /> Sonraki mum <span className="kbd">Boşluk</span>
        </button>
        <button className="btn sm" onClick={() => void S().advanceToDayEnd()} disabled={playing || seekingSignal || dataWait} title="22:00 UTC'ye kadar tüm mumları, emirleri ve risk kurallarını sırayla işler. Açık pozisyonlar korunur.">
          Gün sonuna ilerle
        </button>
        <button className="btn sm" onClick={() => seekingSignal ? S().stopSignalSeek() : void S().advanceToNextSignal()} disabled={!seekingSignal && (playing || dataWait || !hasSetup)} title={seekingSignal ? 'Sinyal aramasını durdur' : 'Klasik veya Gold sinyaline kadar mumları işler ve tam sinyalde durur'}>
          {seekingSignal ? 'Aramayı durdur' : 'Sinyale ilerle'}
        </button>
        <div className="seg" role="group" aria-label="Hız" style={{ marginLeft: 8 }}>
          {SPEEDS.map((sp, i) => (oneMinute && sp > 4 ? null :
            <button key={sp} aria-pressed={prefs.speed === i} onClick={() => S().setPrefs({ speed: i })} title={`Saniyede ${sp} mum`}>
              {sp === 0.5 ? '½×' : `${sp}×`}
            </button>
          ))}
        </div>
        {seekingSignal && <span className="wait"><span className="spin" /> Sinyal aranıyor</span>}
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
                  const fl = pnlOf(p.side, p.entry, markPrice(p.side, live.price, spreadOf(useApp.getState().settings)), p.lots);
                  const risk = riskOf(p.entry, p.initialSl, p.lots);
                  const slR = p.sl !== undefined && risk ? pnlOf(p.side, p.entry, p.sl, p.lots) / risk : undefined;
                  const tpR = p.tp !== undefined && risk ? pnlOf(p.side, p.entry, p.tp, p.lots) / risk : undefined;
                  return (
                    <tr key={p.id} className={`clickable ${editing?.id === p.id ? 'sel' : ''}`} onClick={() => S().selectLine({ kind: 'pos', id: p.id })}>
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
                  <tr key={o.id} className={`clickable ${editing?.id === o.id ? 'sel' : ''}`} onClick={() => S().selectLine({ kind: 'order', id: o.id })}>
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
