// Builds the TradingView indicators from tradingview/template.pine with the S2C presets and the
// fitted probability model, so the Pine files can never drift from the app.
//   node scripts/build-pine.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
const load = async (p) => { const r = await build({ entryPoints: [p], bundle: true, platform: 'node', format: 'esm', write: false }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
const { GOLD_SETUP_DEFAULTS: G, GOLD_A_SETUP_DEFAULTS: A } = await load('src/lib/parcaVariants.ts');
const { GOLD_MODEL: M } = await load('src/lib/parcaModel.ts');
const tpl = readFileSync('tradingview/template.pine', 'utf8');
const num = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
for (const [file, title, short, name, preset, p] of [
  ['tradingview/parca-gold.pine', 'Parça Gold · S2C', 'PARÇA GOLD', 'GOLD', 'Gold', G],
  ['tradingview/parca-gold-aplus.pine', 'Parça Gold A+ · S2C', 'PARÇA GOLD A+', 'GOLD A+', 'Gold A+', A],
]) {
  let s = tpl.replaceAll('{{TITLE}}', title).replaceAll('{{SHORT}}', short).replaceAll('{{NAME}}', name).replaceAll('{{PRESET}}', preset)
    .replaceAll('{{pivot}}', String(p.pivot)).replaceAll('{{window}}', String(p.window)).replaceAll('{{zoneAge}}', String(p.zoneAge))
    .replaceAll('{{minGap}}', String(p.minGap)).replaceAll('{{session}}', String(p.session === 1)).replaceAll('{{ema}}', String(p.ema === 1))
    .replaceAll('{{adx}}', num(p.adx)).replaceAll('{{minP}}', num(p.minP)).replaceAll('{{room}}', num(p.room ?? 0)).replaceAll('{{noOB}}', String((p.noOB ?? 0) === 1)).replaceAll('{{B}}', num(M.b));
  M.w.forEach((w, j) => { s = s.replaceAll(`{{W${j}}}`, num(w)).replaceAll(`{{M${j}}}`, num(M.mu[j])).replaceAll(`{{S${j}}}`, num(M.sd[j])); });
  if (/\{\{/.test(s)) throw new Error(`unfilled placeholder in ${file}: ${s.match(/\{\{\w+\}\}/)[0]}`);
  // fixed preset values the template does not expose: guard against a preset that changed them
  if (p.biasMode !== 2 || p.sweep !== 0 || p.entry !== 2 || p.rr !== 1 || p.vol !== 0) throw new Error(`${preset}: template supports biasMode 2, sweep 0, entry 2, rr 1, vol 0`);
  writeFileSync(file, s);
  console.log('wrote', file);
}
