import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getHistoricalRates } from 'dukascopy-node';

/**
 * Local XAU/USD candle endpoint. Real spot gold from Dukascopy, downloaded on demand and cached
 * on disk in .cache/dukascopy, so the browser never needs an API key.
 *   GET /api/candles?tf=1m|5m|15m|1h|4h&from=<ms>&to=<ms>  →  [[t, o, h, l, c, v], ...]
 */
const TF = { '1m': 'm1', '5m': 'm5', '15m': 'm15', '1h': 'h1', '4h': 'h4' } as const;

async function candles(req: IncomingMessage, res: ServerResponse) {
  const u = new URL(req.url ?? '', 'http://local');
  const tf = u.searchParams.get('tf') as keyof typeof TF;
  const from = Number(u.searchParams.get('from'));
  const to = Math.min(Number(u.searchParams.get('to')), Date.now() - 60_000);
  if (!TF[tf] || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    res.statusCode = 400;
    res.end('bad request');
    return;
  }
  try {
    const rows = await getHistoricalRates({
      instrument: 'xauusd',
      dates: { from: new Date(from), to: new Date(to) },
      timeframe: TF[tf],
      priceType: 'bid',
      format: 'json',
      volumes: true,
      ignoreFlats: true,
      useCache: true,
      cacheFolderPath: '.cache/dukascopy',
    });
    const out = (rows as { timestamp: number; open: number; high: number; low: number; close: number; volume?: number }[])
      .filter((b) => b.timestamp >= from && b.timestamp < to)
      .map((b) => [b.timestamp, b.open, b.high, b.low, b.close, b.volume ?? 0]);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 502;
    res.end(String(e));
  }
}

function xauApi(): Plugin {
  return {
    name: 's2c-xau-api',
    configureServer(server) {
      server.middlewares.use('/api/candles', candles);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/candles', candles);
    },
  };
}

export default defineConfig({
  plugins: [react(), xauApi()],
  server: { port: 5198, strictPort: true, watch: { ignored: ['**/.cache/**'] } },
});
