// Fit a small, regularized win/loss classifier from logged Gold 1m trades.
// The model and score threshold use only the first seven chronological windows;
// the later three are a legacy validation slice, not an untouched holdout.
import fs from 'node:fs';

const input = 'analysis/account-1m-ftm-plus-5000-gold-gold-10-fixed30d.jsonl';
const accounts = fs.readFileSync(input, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const rows = accounts.flatMap((a) => (a.trades ?? []).filter((t) => t.ctx && Number.isFinite(t.pnl))
  .map((t) => ({ start: new Date(a.starts?.[0] ?? t.openedAt).toISOString().slice(0, 10), ...t })));
const starts = [...new Set(rows.map((r) => r.start))].sort();
if (starts.length < 5) throw new Error(`Need at least five distinct start windows; found ${starts.length}`);
const splitAt = Math.floor(starts.length * 0.7);
const trainStarts = starts.slice(0, splitAt), validationStarts = starts.slice(splitAt);
const train = rows.filter((r) => trainStarts.includes(r.start));
const validation = rows.filter((r) => validationStarts.includes(r.start));

// liqR exists on live setup marks but was not copied into these account JSONLs.
// Do not substitute aheadR: it is calculated from different daily/session/4h levels.
// Source is compressed to a few stable timeframe buckets to keep parameter count low.
const featureNames = ['intercept', 'source_5m', 'source_15m', 'source_1h', 'strong', 'long', 'hour_sin', 'hour_cos'];
function features(t) {
  const s = String(t.ctx.source ?? '');
  const hour = Number(t.ctx.hourUtc ?? new Date(t.ctx.signalT ?? t.openedAt).getUTCHours());
  const angle = 2 * Math.PI * hour / 24;
  return [1, Number(s.startsWith('5dk ')), Number(s.startsWith('15dk ')), Number(s.startsWith('1sa ')),
    Number(t.ctx.strong === true), Number(t.side === 'long'), Math.sin(angle), Math.cos(angle)];
}
const lambda = 0.15; // mean logistic loss + lambda/2 * squared non-intercept weights
const sigmoid = (x) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, x))));
function fit(data) {
  const w = Array(featureNames.length).fill(0);
  const lr = 0.08;
  for (let iter = 0; iter < 12000; iter++) {
    const g = Array(w.length).fill(0);
    for (const t of data) {
      const x = features(t), y = Number(t.pnl > 0), p = sigmoid(x.reduce((s, v, i) => s + v * w[i], 0));
      for (let i = 0; i < w.length; i++) g[i] += (p - y) * x[i] / data.length;
    }
    for (let i = 1; i < w.length; i++) g[i] += lambda * w[i];
    for (let i = 0; i < w.length; i++) w[i] -= lr * g[i];
  }
  return w;
}
const weights = fit(train);
const score = (t) => sigmoid(features(t).reduce((s, v, i) => s + v * weights[i], 0));
const stats = (xs) => {
  const n = xs.length, wins = xs.filter((t) => t.pnl > 0).length, pnl = xs.reduce((s, t) => s + t.pnl, 0);
  return { n, winRate: n ? wins / n : 0, netPnl: pnl, pnlPerTrade: n ? pnl / n : 0 };
};
const scoredTrain = train.map((t) => ({ ...t, modelScore: score(t) }));
const scoredValidation = validation.map((t) => ({ ...t, modelScore: score(t) }));
const baseTrain = stats(scoredTrain), baseValidation = stats(scoredValidation);
// Select one score threshold on TRAIN only. Require at least 20 retained trades,
// >=25% retention, higher win rate, and no decrease in net P/L per trade.
const thresholds = Array.from({ length: 9 }, (_, i) => +(0.30 + i * 0.05).toFixed(2));
const candidates = thresholds.map((threshold) => ({ threshold,
  train: stats(scoredTrain.filter((t) => t.modelScore >= threshold)),
  validation: stats(scoredValidation.filter((t) => t.modelScore >= threshold)),
}));
const eligible = candidates.filter((c) => c.train.n >= 20 && c.train.n >= baseTrain.n * 0.25 &&
  c.train.winRate > baseTrain.winRate && c.train.pnlPerTrade >= baseTrain.pnlPerTrade);
eligible.sort((a, b) => b.train.winRate - a.train.winRate || b.train.pnlPerTrade - a.train.pnlPerTrade || a.threshold - b.threshold);
const chosen = eligible[0] ?? { threshold: 0, train: baseTrain, validation: baseValidation };
const results = { baseline: { train: baseTrain, validation: baseValidation }, thresholdCandidates: candidates,
  selectedThreshold: chosen.threshold, selectedTrain: chosen.train, selectedValidation: chosen.validation };
const model = {
  version: 1, instrument: 'XAU/USD', timeframe: '1m', preset: 'Gold', target: 'net pnl > 0',
  trainedOn: trainStarts, excludedValidationWindows: validationStarts,
  featureNames, weights: Object.fromEntries(featureNames.map((name, i) => [name, weights[i]])),
  intercept: weights[0], regularization: { type: 'L2', lambda, objective: 'mean logistic loss + lambda/2 * squared non-intercept weights' },
  sourceBuckets: { '5dk': 'source starts with 5dk followed by space', '15dk': 'source starts with 15dk followed by space', '1h': 'source starts with 1sa followed by space', baseline: 'all other source strings' },
  hourEncoding: 'hourUtc encoded as sin(2*pi*hour/24), cos(2*pi*hour/24)',
  score: 'sigmoid(intercept + weighted features); estimated win score, not calibrated guarantee',
  threshold: chosen.threshold, thresholdSelection: 'TRAIN only: n>=20, retain>=25%, winRate>baseline, pnlPerTrade>=baseline; maximize train winRate, then pnlPerTrade',
  trainingSample: train.length, validationSample: validation.length,
  unavailableFeature: 'liqR is not persisted in source JSONL; aheadR is a separate metric and was not used.',
};
fs.writeFileSync('analysis/train-1m-corrected-model.json', JSON.stringify(model, null, 2));
fs.writeFileSync('analysis/train-1m-corrected-results.json', JSON.stringify({ metadata: {
  generatedAt: new Date().toISOString(), input, instrument: 'XAU/USD', timeframe: '1m',
  uniqueStartWindows: starts, trainWindows: trainStarts, chronologicalValidationWindows: validationStarts,
  samples: { total: rows.length, train: train.length, validation: validation.length },
  selection: model.thresholdSelection,
  limitations: ['All periods were previously examined; validation is not an untouched holdout.',
    'Filtered outcomes are trade-level deletion estimates, not a replay: omitted trades can free a position slot for signals absent from this log.',
    'Gold 5m model probability was not used as a feature; liqR was absent from persisted JSONL.'],
}, model, results }, null, 2));

const pct = (x) => `${(100 * x).toFixed(1)}%`, usd = (x) => `$${x.toFixed(2)}`;
const lines = candidates.map((c) => `| ${c.threshold.toFixed(2)} | ${c.train.n} | ${pct(c.train.winRate)} | ${usd(c.train.pnlPerTrade)} | ${c.validation.n} | ${pct(c.validation.winRate)} | ${usd(c.validation.pnlPerTrade)} | ${usd(c.validation.netPnl)} |`);
let md = `# Gold 1m sonuç skoru: düzenlileştirilmiş lojistik model\n\n`;
md += `Yalnızca Gold presetindeki ${rows.length} gerçek store işlemi kullanıldı. Hedef, komisyon sonrası pnl'nin pozitif olmasıdır. İlk ${train.length} işlem (7 dönem) ile model eğitildi; son ${validation.length} işlem (3 dönem) sadece kronolojik karşılaştırmadır. Bu eski dönemler önceki raporlarda incelendiğinden gerçek untouched holdout değiller.\n\n`;
md += `## Model girdileri ve katsayılar\n\n8 katsayılı L2 lojistik regresyon: intercept, source 5dk/15dk/1sa kovaları (referans diğer kaynak), strong, long yönü, UTC saat sinüs/kosinüsü. L2 lambda=${lambda}; amaç fonksiyonu ortalama lojistik kayıp + lambda/2 × intercept dışı katsayı kareleri. Kaydedilen Gold prob (5dk model olasılığı) kullanılmadı. liqR logda yok; aheadR farklı olduğundan ikame edilmedi.\n\n`;
md += `| Özellik | Katsayı |\n| --- | ---: |\n${featureNames.map((n) => `| ${n} | ${weights[featureNames.indexOf(n)].toFixed(6)} |`).join('\n')}\n\n`;
md += `Skor sigmoid(intercept + katsayı × özellikler) ile 0–1 aralığına çevrilen tahmindir; kalibre edilmiş başarı garantisi değildir. Model JSON: [train-1m-corrected-model.json](train-1m-corrected-model.json).\n\n`;
md += `## Eşik seçimi ve karşılaştırma\n\nEşik adayları sadece TRAIN üzerinde incelendi. En az 20 işlem ve %25 elde tutma, baz win rate'ten yüksek oran ve baz net P/L/işlemden kötü olmayan sonuç şartlarıyla TRAIN win rate en yüksek eşik seçildi; eşitlikte TRAIN P/L/işlem kullanıldı. Seçilen eşik: **${chosen.threshold.toFixed(2)}** (${eligible.length ? 'TRAIN koşullarını karşıladı' : 'koşulları karşılayan eşik yok; filtre uygulanmadı'}). VALIDATION eşik seçiminde kullanılmadı.\n\n`;
md += `| Eşik | TRAIN n | TRAIN win | TRAIN net/işlem | VALIDATION n | VALIDATION win | VALIDATION net/işlem | VALIDATION net toplam |\n| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${lines.join('\n')}\n\n`;
md += `Baz çizgisi TRAIN: n=${baseTrain.n}, win ${pct(baseTrain.winRate)}, net/işlem ${usd(baseTrain.pnlPerTrade)}; validation: n=${baseValidation.n}, win ${pct(baseValidation.winRate)}, net/işlem ${usd(baseValidation.pnlPerTrade)}. Seçilen eşik TRAIN: win ${pct(chosen.train.winRate)}, net/işlem ${usd(chosen.train.pnlPerTrade)}; validation: n=${chosen.validation.n}, win ${pct(chosen.validation.winRate)}, net/işlem ${usd(chosen.validation.pnlPerTrade)}, toplam ${usd(chosen.validation.netPnl)}.\n\n`;
md += `## Sınırlar\n\n- 158 işlem ve 10 ayrı tarih penceresi küçük örneklem; model sadece yedi eski pencerede eğitildi. Validation üç penceredir ve geçmişte görülmüştür. Yeni ${'2026-07-03–2026-08-11'} tarih aralığı modele/eşik seçimine katılmadı.\n`;
md += `- Source, strong, side ve UTC hour sinyal anındaki kayıttan gelir; saat sinyal zamanına göre hesaplanmıştır. Haber değişkeni kullanılmadı. Gold prob bilerek dışarıda tutuldu; bu 1m işlem tahmini 5m Gold modeli olasılığı diye sunulmuyor.\n`;
md += `- Model skoru Gold sinyallerinin bütün listesini yeniden oynatmaz. Bir işlemi filtrelemek, aynı simülasyonda o sırada açık pozisyon nedeniyle atlanmış başka bir sinyali alınabilir kılar; o alternatif sinyaller JSONL'de saklanmadı. Dolayısıyla validation tablo değerleri koşullu, trade-silme karşılaştırmasıdır.\n`;
md += `- Dosyadaki işlem pnl'si model komisyonunu zaten düşmüştür; win=net pnl>0. Filtre sonuçları pozitif net beklenti veya prop hesap geçişi kanıtı değildir. Uygulamaya almadan önce dondurulmuş model ve eşikle yeni tarihlerde tam sinyal üretimi, pozisyon yönetimi ve komisyonlu replay gerekir.\n\n`;
md += `Tekrar üretim: node scripts/train-1m-corrected.mjs.`;
fs.writeFileSync('analysis/train-1m-corrected-report.md', md);
console.log(`Wrote model, results, and report (${rows.length} Gold trades; train ${train.length}; validation ${validation.length}; threshold ${chosen.threshold.toFixed(2)}).`);
