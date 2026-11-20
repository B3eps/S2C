// S2C launcher: installs once, rebuilds when the source changed, serves the app on a fixed
// local port and opens the browser. Closing the window stops the app.
// The port never changes: browser storage (accounts, trades, journal) belongs to this exact
// address, so a different port would look like an empty app.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5199;
const URL = `http://localhost:${PORT}/`;
process.chdir(ROOT);

const say = (s) => console.log(`  ${s}`);
const npm = (args) => {
  // fixed, internal arguments only: a single command string keeps Windows' npm.cmd happy
  const r = spawnSync(`npm ${args.join(' ')}`, { stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    say(`"npm ${args.join(' ')}" başarısız oldu. Yukarıdaki hatayı kontrol et.`);
    process.exit(1);
  }
};
const openBrowser = () => {
  if (process.env.S2C_NO_OPEN) return;
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', URL]] : process.platform === 'darwin' ? ['open', [URL]] : ['xdg-open', [URL]];
  spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref();
};

const newest = (dir) => {
  let t = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    t = Math.max(t, e.isDirectory() ? newest(p) : statSync(p).mtimeMs);
  }
  return t;
};

console.log('\n  S2C\n');

// 1. already running? just open it
try {
  const res = await fetch(URL, { signal: AbortSignal.timeout(1500) });
  if (res.ok && (await res.text()).includes('<title>S2C</title>')) {
    say(`S2C zaten çalışıyor: ${URL}`);
    openBrowser();
    process.exit(0);
  }
  say(`${PORT} portunu başka bir program kullanıyor. Onu kapatıp tekrar dene.`);
  process.exit(1);
} catch {
  /* nothing listening: start below */
}

// 2. install dependencies on the first run, and again when an update changed them
// (npm writes node_modules/.package-lock.json after every install)
const installed = path.join(ROOT, 'node_modules', '.package-lock.json');
if (!existsSync(path.join(ROOT, 'node_modules'))) {
  say('İlk çalıştırma: bağımlılıklar kuruluyor (bir kez, birkaç dakika sürebilir)…');
  npm(['ci']);
} else if (!existsSync(installed) || statSync(path.join(ROOT, 'package-lock.json')).mtimeMs > statSync(installed).mtimeMs) {
  say('Güncelleme: yeni bağımlılıklar kuruluyor…');
  npm(['ci']);
}

// 3. rebuild when the app source is newer than the last build
const built = existsSync(path.join(ROOT, 'dist', 'index.html')) ? statSync(path.join(ROOT, 'dist', 'index.html')).mtimeMs : 0;
const source = Math.max(newest(path.join(ROOT, 'src')), statSync(path.join(ROOT, 'index.html')).mtimeMs, newest(path.join(ROOT, 'public')));
if (source > built) {
  say('Uygulama hazırlanıyor…');
  npm(['run', 'build:web']);
}

// 4. serve and open
const { preview } = await import('vite');
const server = await preview({ root: ROOT, logLevel: 'warn', preview: { port: PORT, strictPort: true, open: false } });
say(`Çalışıyor: ${URL}`);
say('Kapatmak için bu pencereyi kapat (ya da S2C-Kapat.bat).');
say('Verilerin bu bilgisayarda, tarayıcının içinde ve bu adrese bağlı. Ayarlar → Yedekleme ile düzenli yedek al.\n');
openBrowser();

const stop = () => server.httpServer.close(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
