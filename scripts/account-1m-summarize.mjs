// Summarize one or more S2C 1m account JSONL outputs into a compact, explicit report.
// Usage: node scripts/account-1m-summarize.mjs analysis/account-1m-ftm-plus-5000-*.jsonl
import fs from 'node:fs';
import path from 'node:path';

const inputs = process.argv.slice(2).filter((p) => fs.existsSync(p));
if (!inputs.length) throw new Error('Pass at least one existing account JSONL file');
const files = inputs.flatMap((p) => fs.statSync(p).isDirectory()
  ? fs.readdirSync(p).filter((f) => /^account-1m-ftm-plus-5000-.*\.jsonl$/.test(f) && !f.includes('contaminated')).map((f) => path.join(p, f))
  : [p]);
const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;
const pct = (n, d) => `${d ? (100 * n / d).toFixed(1) : '0.0'}%`;
const stamp = (t) => t ? new Date(t).toISOString().replace('T', ' ').slice(0, 16) : '—';
const table = (head, rows) => `| ${head.join(' | ')} |\n| ${head.map(() => '---').join(' | ')} |\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`;
const runs = files.map((file) => ({ file, accounts: fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) }));
let md = `# 1m FTM Infinity Plus account simulation\n\nGenerated ${new Date().toISOString()}\n\n`;
md += `**Payout interpretation.** The $200 stop threshold is cumulative trader-share payout after the program split and any store payout fee. S2C requests the full available balance; it cannot request exactly $200, so a payout may overshoot. The modeled $39 account purchase fee is separate and is deducted in the net-after-fee column (exactly $200 trader share less one $39 fee = $161). The simulation did not charge external funds.\n\n`;
md += `**Limits.** Historical XAU/USD Dukascopy bid candles with the app's configured spread/commission model; this is not FTM's live Hyperliquid gold perpetual feed. FTM Plus rules currently encoded in S2C are $5,000, 10% evaluation target, 3% daily, 5% static max loss, 80% first four splits, $39 fee. Official program terms are at [ftmperps.com](https://www.ftmperps.com/) and may change. 1m setups; signals execute through the real S2C store. The main 30-day runs assign distinct first dates per account; when later sessions are available, gaps between sampled windows are skipped, so these are not continuous market histories. Accounts sharing a window remain correlated. Active challenges at the end of 30 days are right-censored, not failed.\n`;
md += `\n## Per-run summary\n\n` + table(['Run', 'Preset / horizon', 'Accounts', 'Unique first dates', 'Passed / funded', 'Violated', 'Censored', 'Reached $200 share', 'Gross withdrawals', 'Trader share', 'Virtual fees', 'After fee', 'Trades'], runs.map(({ file, accounts: A }) => {
  const allTrades = A.flatMap((a) => a.trades ?? []), paid = A.reduce((s, a) => s + (a.payoutsTotal ?? 0), 0), gross = A.reduce((s, a) => s + (a.payoutsGross ?? 0), 0), fees = A.reduce((s, a) => s + (a.fee ?? 39), 0);
  const preset = A[0]?.preset ?? path.basename(file).split('-').slice(-2, -1)[0] ?? '?';
  const dayMatch = path.basename(file).match(/(\d+)d/i);
  const days = A[0]?.maxDays ?? (dayMatch ? dayMatch[1] : '?');
  const funded = A.filter((a) => a.phase === 'funded' || a.nPayouts > 0).length;
  const violated = A.filter((a) => a.status === 'violated').length;
  const censored = A.filter((a) => a.status === 'active' && a.phase === 'challenge' && String(a.reason).includes('süre doldu')).length;
  const unique = new Set(A.map((a) => a.starts?.[0] ? new Date(a.starts[0]).toISOString().slice(0, 10) : 'unknown')).size;
  return [path.basename(file).replace(/^account-1m-ftm-plus-5000-/, '').replace(/\.jsonl$/, ''), `${preset} / ${days}d`, A.length, unique, funded, violated, censored,
    A.filter((a) => (a.payoutsTotal ?? 0) >= 200).length, fmt(gross), fmt(paid), fmt(fees), fmt(paid - fees), allTrades.length];
}));

for (const { file, accounts: A } of runs) {
  const T = A.flatMap((a, ai) => (a.trades ?? []).map((t) => ({ ...t, account: a, ai })));
  const starts = new Map();
  for (const a of A) { const day = a.starts?.[0] ? new Date(a.starts[0]).toISOString().slice(0, 10) : 'unknown'; starts.set(day, (starts.get(day) ?? 0) + 1); }
  const wins = T.filter((t) => t.pnl > 0).length, commission = T.reduce((s, t) => s + (t.commission ?? 0), 0);
  const signalMismatch = A.reduce((s, a) => s + (a.precomputeVerification?.mismatches?.length ?? 0), 0);
  md += `\n## ${path.basename(file)}\n\n`;
  md += `Account/trade JSONL: \`${file.replaceAll('\\\\', '/')}\`; progress log: \`${file.replace(/\\.jsonl$/, '.log').replaceAll('\\\\', '/')}\`. First-start dates: ${[...starts.keys()].sort().join(', ')} (${starts.size}/${A.length} unique).\n\n`;
  md += `Accounts ${A.length}; trades ${T.length}; signals ${A.reduce((s, a) => s + (a.signals ?? 0), 0)}; skipped signals ${A.reduce((s, a) => s + (a.skipped ?? 0), 0)}; trade wins ${pct(wins, T.length)}; realized trade P/L ${fmt(T.reduce((s, t) => s + t.pnl, 0))}; modeled commissions ${fmt(commission)}; precompute mismatches ${signalMismatch}.\n\n`;
  md += `### Account outcomes\n\n` + table(['Account', 'First start', 'Sessions', 'Trades', 'Phase/status', 'Balance', 'Violation / end reason', 'Gross withdrawal', 'Trader share', 'After fee'], A.map((a, i) => [
    `#${a.index ?? i}`, stamp(a.starts?.[0]), a.starts?.length ?? 0, a.trades?.length ?? 0, `${a.phase}/${a.status}`,
    fmt(a.balance), String(a.violation ?? a.reason ?? '').replaceAll('|', '/'), fmt(a.payoutsGross), fmt(a.payoutsTotal), fmt((a.payoutsTotal ?? 0) - (a.fee ?? 39)),
  ]));
  md += `\n### Trades\n\n` + table(['Account', 'Open → close UTC', 'TF', 'Side', 'Lots', 'Entry', 'Stop', 'Target', 'Exit', 'Commission', 'P/L', 'Reason'], T.map((t) => [
    `#${t.account.index ?? t.ai}`, `${stamp(t.openedAt)} → ${stamp(t.closedAt)}`, t.tf ?? '—', t.side, t.lots, Number(t.entry).toFixed(3), t.sl === undefined ? '—' : Number(t.sl).toFixed(3),
    t.tp === undefined ? '—' : Number(t.tp).toFixed(3), Number(t.exit).toFixed(3), fmt(t.commission), fmt(t.pnl), t.reason,
  ]));
  md += `\n### Start-date concentration\n\n` + table(['Start date', 'Accounts'], [...starts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, n]) => [d, n]));
  const targets = A.filter((a) => (a.payoutsTotal ?? 0) >= 200);
  md += `\nActual full-balance payout requests: ${A.reduce((s, a) => s + (a.nPayouts ?? 0), 0)} across ${A.filter((a) => (a.nPayouts ?? 0) > 0).length} accounts. Target reached by ${targets.length}/${A.length}; gross account withdrawals ${fmt(A.reduce((s, a) => s + (a.payoutsGross ?? 0), 0))}, trader share ${fmt(A.reduce((s, a) => s + (a.payoutsTotal ?? 0), 0))}, share less virtual purchase fees ${fmt(A.reduce((s, a) => s + (a.payoutsTotal ?? 0) - (a.fee ?? 39), 0))}.\n`;
}
fs.mkdirSync('analysis', { recursive: true });
const out = 'analysis/account-1m-report.md';
fs.writeFileSync(out, md);
console.log(out);
