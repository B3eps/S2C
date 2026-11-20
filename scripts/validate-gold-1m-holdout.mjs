// One-shot measurement of the frozen Parça Gold rules on a date range kept aside from
// the existing research periods. This script does not select or tune a model.
// Run: node scripts/validate-gold-1m-holdout.mjs
// Output: analysis/gold-1m-holdout-2026-07-03_2026-08-11.json
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { getHistoricalRates } from 'dukascopy-node';

const FROM = Date.parse('2026-07-03T00:00:00Z');
const TO = Date.parse('2026-08-11T00:00:00Z'); // exclusive
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WARMUP_DAYS = 3;
const LOOKBACK_DAYS = 90;
const MAX_HOLD_BARS = 240;
const OUTCOME_TO = TO + MAX_HOLD_BARS * MIN;
const SPREAD = Number(process.env.SPREAD ?? 0.2);
const COMMISSION_PCT = Number(process.env.COMMISSION_PCT ?? 0.005); // per side, % of notional
const LOTS = Number(process.env.LOTS ?? 1);
const CONTRACT = 100;

if (!(SPREAD >= 0) || !(COMMISSION_PCT >= 0) || !(LOTS > 0)) throw new Error('SPREAD, COMMISSION_PCT, or LOTS is invalid');

const load = async (path) => {
  const result = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};
const [market, setup, variants] = await Promise.all([
  load('src/lib/market.ts'),
  load('src/lib/parcaSetup.ts'),
  load('src/lib/parcaVariants.ts'),
]);
const appModel = await load('src/lib/parcaModel1m.ts');
const frozenModel = JSON.parse(await fs.readFile('analysis/train-1m-model.json', 'utf8'));
if (frozenModel.timeframe !== '1m' || frozenModel.preset !== 'Gold' || frozenModel.threshold !== 0.45) {
  throw new Error('Expected the frozen Gold 1m model with threshold 0.45 in analysis/train-1m-model.json');
}
if (frozenModel.trainedOn.some((date) => date >= '2026-07-03') || frozenModel.excludedValidationWindows.some((date) => date >= '2026-07-03')) {
  throw new Error('The frozen model metadata overlaps the holdout start date');
}

const rates = async (tf, from, to) => {
  const rows = await getHistoricalRates({
    instrument: 'xauusd',
    dates: { from: new Date(from), to: new Date(to) },
    timeframe: tf,
    priceType: 'bid',
    format: 'json',
    volumes: true,
    ignoreFlats: true,
    useCache: true,
    cacheFolderPath: '.cache/dukascopy',
  });
  return rows
    .filter((b) => b.timestamp >= from && b.timestamp < to && !market.isClosed(b.timestamp))
    .map((b) => ({ t: b.timestamp, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume ?? 0 }));
};

const aggregate = (bars, sizeMs) => {
  const out = [];
  for (const b of bars) {
    const t = Math.floor(b.t / sizeMs) * sizeMs;
    const last = out.at(-1);
    if (last?.t === t) {
      last.h = Math.max(last.h, b.h);
      last.l = Math.min(last.l, b.l);
      last.c = b.c;
      last.v += b.v;
    } else out.push({ ...b, t });
  }
  return out;
};

const h1From = FROM - LOOKBACK_DAYS * DAY;
const [bars, h1] = await Promise.all([
  rates('m1', FROM, OUTCOME_TO),
  rates('h1', h1From, OUTCOME_TO),
]);
if (!bars.length) throw new Error('No 1m Dukascopy bars loaded for the holdout period');
if (!h1.length) throw new Error('No hourly Dukascopy warmup bars loaded');

const h4 = aggregate(h1, 4 * HOUR);
const m5 = aggregate(bars, 5 * MIN);
const m15 = aggregate(bars, 15 * MIN);
const series = { '5m': m5, '15m': m15, '1h': h1, '4h': h4 };
const days = market.dailyBars(h1);
const params = variants.GOLD_SETUP_DEFAULTS;
const result = setup.analyzeParcaSetup({ tf: '1m', bars, clock: TO, days, series, params });
const eligibleFrom = FROM + WARMUP_DAYS * DAY;
const signals = result.marks
  .filter((m) => m.kind === 'signal' && m.t >= eligibleFrom && m.t < TO)
  .sort((a, b) => a.t - b.t);
const barIndex = new Map(bars.map((b, i) => [b.t, i]));

function modelScore(mark) {
  const source = mark.source ?? '';
  const features = {
    source_5m: Number(source.includes('5dk')),
    source_15m: Number(source.includes('15dk')),
    source_1h: Number(source.includes('1sa')),
    strong: Number(!!mark.strong),
    long: Number(mark.side === 'long'),
    hour_sin: Math.sin((2 * Math.PI * new Date(mark.t).getUTCHours()) / 24),
    hour_cos: Math.cos((2 * Math.PI * new Date(mark.t).getUTCHours()) / 24),
  };
  let z = frozenModel.intercept;
  for (const [key, value] of Object.entries(features)) z += frozenModel.weights[key] * value;
  const jsonScore = 1 / (1 + Math.exp(-z));
  const appScore = appModel.trained1mScore(mark.source ?? '', !!mark.strong, mark.side, mark.t);
  if (Math.abs(jsonScore - appScore) > 1e-14) throw new Error(`JSON/app model score mismatch at ${new Date(mark.t).toISOString()}: ${jsonScore} vs ${appScore}`);
  return { score: appScore, features };
}

const appFilteredSignals = setup.analyzeParcaSetup({
  tf: '1m', bars, clock: TO, days, series,
  params: { ...variants.GOLD_SETUP_DEFAULTS, trained1m: 1 },
}).marks.filter((m) => m.kind === 'signal' && m.t >= eligibleFrom && m.t < TO).map((m) => m.t);
const offlineFilteredSignals = signals.filter((m) => modelScore(m).score >= frozenModel.threshold).map((m) => m.t);
const filteredTimestampMismatchCount = offlineFilteredSignals.filter((t, i) => appFilteredSignals[i] !== t).length
  + Math.max(0, appFilteredSignals.length - offlineFilteredSignals.length);
const appParity = {
  modelScoresCompared: signals.length,
  scoreMismatchCount: 0,
  offlineFilteredSignals: offlineFilteredSignals.length,
  appFilteredSignals: appFilteredSignals.length,
  filteredTimestampMismatchCount,
};
if (filteredTimestampMismatchCount !== 0) throw new Error(`Offline/app filtered signal mismatch: ${JSON.stringify(appParity)}`);

function simulate(mark, nextIndex) {
  const entryBar = bars[nextIndex];
  if (!entryBar) return { status: 'no-next-bar' };
  const long = mark.side === 'long';
  // Dukascopy candles are BID: long entry is ASK; short entry is BID.
  const fill = long ? entryBar.o + SPREAD : entryBar.o;
  const stop = mark.stop;
  const target = mark.target;
  const stopAlreadyCrossed = long ? entryBar.o <= stop : entryBar.o + SPREAD >= stop;
  if (stopAlreadyCrossed) {
    return { status: 'gap-through-stop-before-entry', fill, fillT: entryBar.t, stop, target };
  }
  const risk = Math.abs(fill - stop);
  if (!(risk > 0) || !Number.isFinite(target)) return { status: 'invalid-risk-or-target', fill, fillT: entryBar.t, stop, target };

  const end = Math.min(bars.length, nextIndex + MAX_HOLD_BARS);
  let exit = NaN;
  let exitT;
  let reason = 'timeout';
  let exitIndex = end - 1;
  for (let i = nextIndex; i < end; i++) {
    const b = bars[i];
    // Close a short on the ASK; close a long on the BID. Stop wins same-bar ties.
    const shift = long ? 0 : SPREAD;
    const open = b.o + shift;
    const high = b.h + shift;
    const low = b.l + shift;
    const stopHit = long ? low <= stop : high >= stop;
    const targetHit = long ? high >= target : low <= target;
    if (stopHit) {
      exit = long ? Math.min(open, stop) : Math.max(open, stop);
      reason = 'stop';
      exitIndex = i;
      break;
    }
    if (targetHit) {
      exit = long ? Math.max(open, target) : Math.min(open, target);
      reason = 'target';
      exitIndex = i;
      break;
    }
  }
  if (!Number.isFinite(exit)) {
    const last = bars[exitIndex];
    exit = long ? last.c : last.c + SPREAD;
    reason = 'timeout';
  }
  exitT = bars[exitIndex].t;

  const direction = long ? 1 : -1;
  const grossPnlUsd = direction * (exit - fill) * CONTRACT * LOTS;
  const commissionUsd = (fill + exit) * CONTRACT * LOTS * COMMISSION_PCT / 100;
  const netPnlUsd = grossPnlUsd - commissionUsd;
  const riskUsd = risk * CONTRACT * LOTS;
  return {
    status: 'traded', reason, fill, fillT: entryBar.t, stop, target,
    risk, riskUsd, exit, exitT, grossPnlUsd, commissionUsd, netPnlUsd,
    grossR: grossPnlUsd / riskUsd, netR: netPnlUsd / riskUsd,
    barsHeld: exitIndex - nextIndex + 1,
  };
}

function replay(applyFilter) {
  let busyUntil = -1;
  return signals.map((mark, i) => {
    const { score, features } = modelScore(mark);
    const signalIndex = barIndex.get(mark.t);
    const nextIndex = Number.isInteger(signalIndex) ? signalIndex + 1 : -1;
    if (applyFilter && score < frozenModel.threshold) return { status: 'filtered-below-threshold', score, features };
    if (nextIndex < 0 || nextIndex >= bars.length) return { status: 'no-next-bar', score, features };
    if (nextIndex <= busyUntil) return { status: 'skipped-open-position', score, features };
    const outcome = simulate(mark, nextIndex);
    outcome.score = score;
    outcome.features = features;
    if (outcome.status === 'traded') busyUntil = barIndex.get(outcome.exitT) ?? nextIndex;
    return outcome;
  });
}

const baselineOutcomes = replay(false);
const filteredOutcomes = replay(true);
const rows = signals.map((mark, i) => ({
  t: mark.t,
  time: new Date(mark.t).toISOString(),
  side: mark.side,
  source: mark.source,
  strong: !!mark.strong,
  /** The app's displayed Gold score is from the 5m model and is intentionally not used here. */
  gold5mProb: mark.prob ?? null,
  modelScore: baselineOutcomes[i].score,
  modelFeatures: baselineOutcomes[i].features,
  signalEntry: mark.entry,
  stop: mark.stop,
  target: mark.target,
  signalRisk: Math.abs(mark.entry - mark.stop),
  baseline: baselineOutcomes[i],
  modelFiltered: filteredOutcomes[i],
}));

const summarizeOutcomes = (outcomes) => {
  const traded = outcomes.filter((o) => o.status === 'traded');
  const summarize = (key) => {
    const a = traded.map((o) => o[key]);
    return {
      mean: a.length ? a.reduce((s, x) => s + x, 0) / a.length : null,
      sum: a.length ? a.reduce((s, x) => s + x, 0) : null,
    };
  };
  const counts = Object.fromEntries([...new Set(outcomes.map((o) => o.status))].map((status) => [status, outcomes.filter((o) => o.status === status).length]));
  return {
    outcomes: counts,
    traded: traded.length,
    winsNet: traded.filter((o) => o.netPnlUsd > 0).length,
    winRateNet: traded.length ? traded.filter((o) => o.netPnlUsd > 0).length / traded.length : null,
    grossR: summarize('grossR'),
    netR: summarize('netR'),
    grossPnlUsd: summarize('grossPnlUsd').sum,
    commissionUsd: traded.reduce((s, o) => s + o.commissionUsd, 0),
    netPnlUsd: summarize('netPnlUsd').sum,
  };
};
const summary = {
  signals: signals.length,
  appParity,
  baseline: summarizeOutcomes(baselineOutcomes),
  modelFiltered: summarizeOutcomes(filteredOutcomes),
  threshold: frozenModel.threshold,
};

const output = {
  metadata: {
    purpose: 'Frozen-rule holdout measurement only; do not use this range for candidate, feature, or threshold selection.',
    instrument: 'XAU/USD',
    provider: 'Dukascopy BID candles',
    timeframe: '1m',
    from: new Date(FROM).toISOString(),
    toExclusive: new Date(TO).toISOString(),
    outcomeDataTo: new Date(OUTCOME_TO).toISOString(),
    warmupDaysExcluded: WARMUP_DAYS,
    h1WarmupDays: LOOKBACK_DAYS,
    candleCounts: { m1: bars.length, m5: m5.length, m15: m15.length, h1: h1.length, h4: h4.length },
    rules: 'GOLD_SETUP_DEFAULTS from src/lib/parcaVariants.ts; the baseline uses every signal and the model replay filters at the frozen analysis/train-1m-model.json threshold.',
    frozenModel: {
      path: 'analysis/train-1m-model.json',
      threshold: frozenModel.threshold,
      trainedOn: frozenModel.trainedOn,
      excludedValidationWindows: frozenModel.excludedValidationWindows,
      target: frozenModel.target,
      featureNames: frozenModel.featureNames,
      weights: frozenModel.weights,
      score: frozenModel.score,
    },
    scoreParity: 'Each JSON score is checked against src/lib/parcaModel1m.ts trained1mScore; thresholded app-engine signal times are checked against offline selection.',
    execution: 'First available 1m bar open after the signal candle close; long entry at BID+spread, short entry at BID; short exits on ASK; stop first on same-bar stop/target; gaps fill at open; one position at a time; 240 available 1m bars maximum hold. Bars are fetched through the full holding horizon after the last eligible signal.',
    spread: SPREAD,
    commissionPctPerSide: COMMISSION_PCT,
    lotsForUsdMetrics: LOTS,
    contract: CONTRACT,
    probabilityNote: 'The baseline model score is the frozen 1m model in analysis/train-1m-model.json. gold5mProb is recorded separately from src/lib/parcaModel.ts; that chart score was trained on 5m data, is not calibrated on 1m, and is not used as a model feature.',
    dataCache: '.cache/dukascopy (useCache=true)',
  },
  summary,
  appParity,
  signals: rows,
};

const outputPath = 'analysis/gold-1m-holdout-2026-07-03_2026-08-11.json';
await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
const pct = (n) => n == null ? '—' : `${(100 * n).toFixed(1)}%`;
const money = (n) => n == null ? '—' : `$${n.toFixed(2)}`;
const rmean = (n) => n == null ? '—' : `${n.mean.toFixed(4)}R`;
const report = [
  '# Gold 1m dondurulmuş model holdout',
  '',
  `Dönem: ${new Date(FROM).toISOString()} – ${new Date(TO).toISOString()} (son tarih hariç). Eşik ve model seçimi bu aralık kullanılmadan donduruldu.`,
  '',
  `Model: \`analysis/train-1m-model.json\`, threshold ${frozenModel.threshold}; eğitim pencereleri: ${frozenModel.trainedOn.join(', ')}. Girdiler source bucket, strong, side ve UTC saati. Hedef: komisyon sonrası pnl > 0.`,
  '',
  `Sinyal sayısı: ${summary.signals}. Spread $${SPREAD.toFixed(2)}; komisyon ${COMMISSION_PCT}% notional / taraf; next available 1m open fills; stop first; one position at a time; max hold ${MAX_HOLD_BARS} active minute bars.`,
  '',
  `Uygulama eşleşme kontrolü: ${appParity.modelScoresCompared} model skoru karşılaştırıldı; JSON/app skor farkı ${appParity.scoreMismatchCount}; offline eşik sinyali ${appParity.offlineFilteredSignals}, app motoru ${appParity.appFilteredSignals}; tarih farkı ${appParity.filteredTimestampMismatchCount}.`,
  '',
  '| Replay | İşlem | Net win rate | Ortalama net R | Toplam net P/L (1 lot) | Komisyon |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
  `| Gold baseline | ${summary.baseline.traded} | ${pct(summary.baseline.winRateNet)} | ${rmean(summary.baseline.netR)} | ${money(summary.baseline.netPnlUsd)} | ${money(summary.baseline.commissionUsd)} |`,
  `| 1m model ≥ ${frozenModel.threshold} | ${summary.modelFiltered.traded} | ${pct(summary.modelFiltered.winRateNet)} | ${rmean(summary.modelFiltered.netR)} | ${money(summary.modelFiltered.netPnlUsd)} | ${money(summary.modelFiltered.commissionUsd)} |`,
  '',
  'Fill varsayımları: Dukascopy BID mumları; long giriş ask (bid + spread), short giriş bid; short çıkış ask; giriş bir sonraki mevcut 1m mumunun açılışında; aynı mum stop ve hedefe değerse stop önce; gap stop/target açılış fiyatına göre; Gold sinyalindeki stop ve 1R hedef sabit; tek açık pozisyon; 240 gerçek 1m bar sonra kapanış fiyatından çıkış. Son sinyallerin sonucunu sansürlememek için mumlar test pencere bitiminden sonra 240 bar daha alındı. Komisyon her iki tarafta da notional üzerinden alınır.',
  '',
  '`gold5mProb` uygulamanın Gold chartında kullanılan 5m model skorudur; ayrı raporlanır, 1m model özelliği veya filtre eşiği olarak kullanılmaz. 1m model skoru kalibre edilmiş başarı garantisi değildir. Bu tek holdout sonucu yeni eşik/özellik seçmek veya uygulama performansı iddia etmek için kullanılmamalıdır.',
  '',
  `Satır bazlı sinyal ve iki replay çıktısı: \`${outputPath}\`.`,
].join('\n');
const reportPath = 'analysis/gold-1m-holdout-2026-07-03_2026-08-11.md';
await fs.writeFile(reportPath, report);
console.log(`Saved ${outputPath} and ${reportPath}`);
