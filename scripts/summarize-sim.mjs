// Turns analysis/hesaplar-*.jsonl (accounts traded by the real app) into analysis/hesap-raporu.md:
// how many accounts passed, blew up, paid out; where the losses clustered; what would have avoided them.
//   node scripts/summarize-sim.mjs
import fs from 'node:fs';

const OUT = 'analysis';
const files = fs.readdirSync(OUT).filter((f) => /^hesaplar-.*\.jsonl$/.test(f) && !f.includes('deneme')).sort();
const runs = files.map((f) => ({ name: f.replace(/^hesaplar-|\.jsonl$/g, ''), accounts: fs.readFileSync(`${OUT}/${f}`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) })).filter((r) => r.accounts.length);
if (!runs.length) { console.log('veri yok'); process.exit(0); }

const f0 = (x) => (Number.isFinite(x) ? Math.round(x).toLocaleString('tr-TR') : '–');
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2).replace('.', ',') : '–');
const pct = (x) => `${Math.round(x * 100)}%`;
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const table = (head, rows) => `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`;
const NAMES = { 'bem-classic': 'BEM Classic Normal', 'bem-swing': 'BEM Classic Swing', 'bem-one': 'BEM One', 'bem-one-only': 'BEM One Only', 'ftm-infinity': 'FTM Infinity', 'ftm-infinity-plus': 'FTM Infinity Plus' };
const funded = (a) => a.phase === 'funded' || a.nPayouts > 0;
const blown = (a) => a.status === 'violated';

let md = `# Hesap simülasyonu: gerçek uygulama, temiz profil\n\nÜretildi: ${new Date().toISOString().slice(0, 16)} UTC\n\n**Nasıl yapıldı.** Uygulamanın kendi kodu (hesap kuralları, programlar, günlük/toplam zarar, ödeme şartları, spread, komisyon) temiz bir tarayıcı profilinde çalıştırıldı: her koşunun başında hesap/işlem/günlük 0'dı, her hesaptan sonra uygulama sıfırlandı. Senin gerçek verine dokunulmadı. Bir bot, Parça sinyallerinde kuralına göre piyasa emriyle girdi (sinyalin stopu ve hedefi, bakiyenin sabit yüzdesi risk). Mumlar Dukascopy XAU/USD, başlangıç anları 2024-2026 arası gerçek dönemlerden rastgele. Replay'de geleceğe bakmak yok.\n`;

const sumRuns = [];
for (const r of runs) {
  const A = r.accounts;
  const fee = A.reduce((x, a) => x + (a.fee ?? 0), 0), paid = A.reduce((x, a) => x + a.payoutsTotal, 0);
  sumRuns.push([r.name, A.length, A.filter(funded).length, A.filter(blown).length, A.filter((a) => a.nPayouts > 0).length, `$${f0(fee)}`, `$${f0(paid)}`, `$${f0(paid - fee)}`]);
}
md += `\n## 1. Özet (koşu başına)\n\nKoşu adı: \`<sinyal ayarı>-r<işlem başına risk %>\`. "Geçti" = değerlendirmeyi bitirip fonlu hesaba ulaştı. "Ödeme" = en az bir ödeme alındı. Net = alınan ödeme − hesap ücreti.\n\n` + table(['Koşu', 'Hesap', 'Geçti', 'İhlal (patladı)', 'Ödeme alan', 'Toplam ücret', 'Toplam ödeme', 'Net'], sumRuns);

for (const r of runs) {
  const A = r.accounts;
  const progs = [...new Set(A.map((a) => a.programId))];
  md += `\n## 2. ${r.name}: program program\n\n` + table(['Program', 'Hesap', 'Geçti', 'Patladı', 'Süre doldu/bitmedi', 'Ödeme alan', 'Toplam ödeme', 'Ücret', 'Net', 'Ort. işlem', 'İşlem kazanma', 'Ort. R'], progs.map((p) => {
    const x = A.filter((a) => a.programId === p), tr = x.flatMap((a) => a.trades);
    const paid = x.reduce((s, a) => s + a.payoutsTotal, 0), fee = x.reduce((s, a) => s + (a.fee ?? 0), 0);
    return [NAMES[p] ?? p, x.length, x.filter(funded).length, x.filter(blown).length, x.filter((a) => !funded(a) && !blown(a)).length, x.filter((a) => a.nPayouts > 0).length, `$${f0(paid)}`, `$${f0(fee)}`, `$${f0(paid - fee)}`, f0(mean(x.map((a) => a.trades.length))), tr.length ? pct(tr.filter((t) => t.pnl > 0).length / tr.length) : '–', f2(mean(tr.filter((t) => t.r !== undefined && t.r !== null).map((t) => t.r)))];
  }));
  const reasons = new Map();
  for (const a of A.filter(blown)) { const k = (a.violation ?? '').replace(/\$?[\d.,]+/g, '#').slice(0, 60); reasons.set(k, (reasons.get(k) ?? 0) + 1); }
  if (reasons.size) md += `\n**Hesaplar neden patladı:** ` + [...reasons].map(([k, n]) => `${n}× ${k}`).join(' · ') + '\n';
}

// ── where the losses cluster ────────────────────────────────────────────────────────────────
const all = runs.flatMap((r) => r.accounts.map((a) => ({ ...a, run: r.name })));
const trades = all.flatMap((a, ai) => a.trades.filter((t) => t.ctx).map((t) => ({ ...t, acc: ai, run: a.run, blown: blown(a), win: t.pnl > 0 })));
md += `\n## 3. Kayıplar nerede toplandı?\n\nToplam ${trades.length} işlem (bağlamı kayıtlı), kazanma ${pct(trades.filter((t) => t.win).length / Math.max(1, trades.length))}, ort. R ${f2(mean(trades.map((t) => t.r ?? 0)))}.\n\n`;
const bucket = (name, fn, order) => {
  const g = new Map();
  for (const t of trades) { const k = fn(t); if (k === undefined) continue; if (!g.has(k)) g.set(k, []); g.get(k).push(t); }
  const keys = order ?? [...g.keys()].sort();
  return keys.filter((k) => g.has(k)).map((k) => { const x = g.get(k); return [name, String(k), x.length, pct(x.filter((t) => t.win).length / x.length), f2(mean(x.map((t) => t.r ?? 0))), `$${f0(x.reduce((s, t) => s + t.pnl, 0))}`]; });
};
const rows = [
  ...bucket('Giriş seviyede mi', (t) => (t.ctx.atLevel ? 'seviyede' : 'seviyede değil')),
  ...bucket('Seviye türü', (t) => (t.ctx.atLevel ? t.ctx.levelKind : undefined)),
  ...bucket('Önündeki seviye', (t) => (t.ctx.aheadR < 1 ? '<1R' : t.ctx.aheadR < 2 ? '1–2R' : t.ctx.aheadR < 4 ? '2–4R' : '4R+/yok'), ['<1R', '1–2R', '2–4R', '4R+/yok']),
  ...bucket('Önündeki seviye türü', (t) => (t.ctx.aheadR < 2 ? t.ctx.aheadKind : undefined)),
  ...bucket('Olasılık', (t) => (t.ctx.prob === undefined ? 'yok' : t.ctx.prob < 0.4 ? '<%40' : t.ctx.prob < 0.55 ? '%40–55' : t.ctx.prob < 0.7 ? '%55–70' : '%70+'), ['<%40', '%40–55', '%55–70', '%70+', 'yok']),
  ...bucket('Bölge', (t) => t.ctx.source.replace(' + MSP', '')),
  ...bucket('Yön', (t) => t.side),
  ...bucket('Yıldız (★)', (t) => (t.ctx.strong ? 'var' : 'yok')),
  ...bucket('Haber ±60 dk', (t) => (t.ctx.news60 ? 'haberde' : 'haber dışı')),
  ...bucket('New York saati', (t) => { const h = (t.ctx.hourUtc + 19) % 24; return h < 3 ? '00–03' : h < 6 ? '03–06' : h < 9 ? '06–09' : h < 12 ? '09–12' : h < 16 ? '12–16' : '16–24'; }, ['00–03', '03–06', '06–09', '09–12', '12–16', '16–24']),
  ...bucket('Haftanın günü (UTC)', (t) => ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][t.ctx.dow], ['Pzt', 'Sal', 'Çar', 'Per', 'Cum']),
];
md += table(['Boyut', 'Grup', 'İşlem', 'Kazanma', 'Ort. R', 'Toplam P/L'], rows);

// streaks and what happened right before a blow-up
const streaks = [];
for (const a of all) { let run = 0, best = 0; for (const t of a.trades) { if (t.pnl <= 0) { run++; best = Math.max(best, run); } else run = 0; } streaks.push({ blown: blown(a), best, n: a.trades.length }); }
md += `\n**Üst üste kayıp:** patlayan hesaplarda ortalama en uzun seri ${f2(mean(streaks.filter((s) => s.blown).map((s) => s.best)))}, patlamayanlarda ${f2(mean(streaks.filter((s) => !s.blown).map((s) => s.best)))}. En uzun seri ${Math.max(0, ...streaks.map((s) => s.best))}.\n`;
const lastTrades = all.filter(blown).flatMap((a) => a.trades.slice(-4).filter((t) => t.ctx).map((t) => ({ ...t, win: t.pnl > 0 })));
if (lastTrades.length) md += `\nPatlamadan önceki son 4 işlem (${lastTrades.length} işlem): kazanma ${pct(lastTrades.filter((t) => t.win).length / lastTrades.length)}; seviyede olanlar ${pct(lastTrades.filter((t) => t.ctx.atLevel).length / lastTrades.length)}; önünde 2R'den yakın seviye olanlar ${pct(lastTrades.filter((t) => t.ctx.aheadR < 2).length / lastTrades.length)}.\n`;

// ── what-if: would a rule have saved the accounts? ──────────────────────────────────────────
// Weak groups are chosen on half of the accounts and judged on the other half, so a rule has to hold on accounts it never saw.
const FILTERS = {
  'önünde 1R içinde seviye varsa girme': (t) => t.ctx.aheadR >= 1,
  'önünde 2R içinde seviye varsa girme': (t) => t.ctx.aheadR >= 2,
  'seviyede değilse girme': (t) => t.ctx.atLevel,
  'olasılık < %60 ise girme': (t) => (t.ctx.prob ?? 0) >= 0.6,
  'yıldızsızsa girme': (t) => t.ctx.strong,
  'haber ±60 dk içinde girme': (t) => !t.ctx.news60,
  'ilk 2 işlemden sonra o gün girme': null,
};
const propDay = (ms) => new Date(ms + 2 * 3600e3).toISOString().slice(0, 10);
function pathOutcome(a, keep) {
  // approximate: first challenge step only, realised pnl of the kept trades, static limits from the account's own rules
  const r = a.rules, size = a.size;
  const end = a.stepEnds?.[0] ?? a.trades.length;
  let bal = size, dayKey = '', dayStart = size, kept = 0, peak = size;
  const target = size * (1 + (r.targets?.[0] ?? r.target) / 100);
  for (const t of a.trades.slice(0, end)) {
    if (!keep(t)) continue;
    kept++;
    const dk = propDay(t.closedAt - 60000);
    if (dk !== dayKey) { dayKey = dk; dayStart = Math.max(bal, bal); }
    bal += t.pnl; peak = Math.max(peak, bal);
    const floor = r.maxType === 'trailing' ? Math.max(size * (1 - r.maxLoss / 100), Math.min(peak - size * r.maxLoss / 100, size)) : size * (1 - r.maxLoss / 100);
    if (bal < floor || dayStart - bal > size * r.dailyLoss / 100) return { out: 'patladı', kept, bal };
    if (bal >= target) return { out: 'geçti', kept, bal };
  }
  return { out: 'sürüyor', kept, bal };
}
const evalFilter = (accs, keep) => { const o = { geçti: 0, patladı: 0, sürüyor: 0 }; let bal = 0; for (const a of accs) { const p = pathOutcome(a, keep); o[p.out]++; bal += p.bal - a.size; } return { ...o, bal }; };
const A1 = all.filter((_, i) => i % 2 === 0), A2 = all.filter((_, i) => i % 2 === 1);
const base = { all: evalFilter(all, () => true), a1: evalFilter(A1, () => true), a2: evalFilter(A2, () => true) };
const rowsW = [['hiçbiri (olduğu gibi)', `${base.all.geçti} / ${base.all.patladı} / ${base.all.sürüyor}`, `$${f0(base.all.bal)}`, '', '']];
for (const [name, keep] of Object.entries(FILTERS)) {
  if (!keep) continue;
  const w = { all: evalFilter(all, keep), a1: evalFilter(A1, keep), a2: evalFilter(A2, keep) };
  const dBlown = (x, b) => x.patladı - b.patladı, dPass = (x, b) => x.geçti - b.geçti;
  rowsW.push([name, `${w.all.geçti} / ${w.all.patladı} / ${w.all.sürüyor}`, `$${f0(w.all.bal)}`, `patlama ${dBlown(w.a1, base.a1) >= 0 ? '+' : ''}${dBlown(w.a1, base.a1)}, geçiş ${dPass(w.a1, base.a1) >= 0 ? '+' : ''}${dPass(w.a1, base.a1)}`, `patlama ${dBlown(w.a2, base.a2) >= 0 ? '+' : ''}${dBlown(w.a2, base.a2)}, geçiş ${dPass(w.a2, base.a2) >= 0 ? '+' : ''}${dPass(w.a2, base.a2)}`]);
}
md += `\n## 4. "Bu kural olsaydı para yanmazdı" testi\n\nHer kural, tüm hesapların **ilk değerlendirme aşaması** işlem listesinden uygun olmayan işlemleri çıkarıp hesabı yeniden yürütür (gerçekleşen kâr/zarar, hesabın kendi günlük ve toplam zarar sınırı). Yaklaşık bir hesaptır: lotlar ve bileşik etki yeniden hesaplanmaz. Hesaplar ikiye bölündü (çift/tek sıra): bir kuralın iki yarıda da aynı yönde iyileştirmesi gerekir; yalnız birinde işe yarayan şans olabilir.\n\n` + table(['Kural', 'geçti / patladı / sürüyor', 'Toplam net P/L', 'Yarı 1 (çift) fark', 'Yarı 2 (tek) fark'], rowsW);
md += `\n## 5. Dürüst uyarılar\n\n- Bu bir geçmiş testi; bot kuralı mekanik uyguluyor, insan değil. Gerçekte duygular ve gecikme eklenir.\n- Spread sabit, kayma yok, haber anında gerçek spread çok açılır; sonuçlar gerçekte daha kötü olur.\n- Hesap sayısı arttıkça sonuç güvenilir olur; <30 hesaplı satırlardaki yüzdelere güvenme.\n- Programların kuralları uygulamadaki gibi (firmanın gerçek şartlarını birebir yansıtmayabilir).\n- Kural testi (bölüm 4) yaklaşık hesap; bir kural önerisini uygulamaya almadan önce yine uygulamada denenmeli.\n`;
fs.writeFileSync(`${OUT}/hesap-raporu.md`, md);
console.log('yazıldı', `${OUT}/hesap-raporu.md`, `${all.length} hesap`);
