import { openDB, IDBPDatabase } from 'idb';
import type { Account, SessionRec, SetupRecord, Trade } from './types';
import { isInstrumentId } from './instruments';

const DB = 's2c';
let dbp: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbp)
    dbp = openDB(DB, 2, {
      upgrade(d, oldVersion) {
        if (oldVersion < 1) {
          d.createObjectStore('accounts', { keyPath: 'id' });
          const t = d.createObjectStore('trades', { keyPath: 'id' });
          t.createIndex('accountId', 'accountId');
          d.createObjectStore('sessions', { keyPath: 'id' });
          d.createObjectStore('shots');
          d.createObjectStore('kv');
        }
        if (oldVersion < 2) d.createObjectStore('setups', { keyPath: 'id' });
      },
    });
  return dbp;
}

export const store = {
  async accounts(): Promise<Account[]> {
    return (await db()).getAll('accounts');
  },
  async putAccount(a: Account) {
    await (await db()).put('accounts', a);
  },
  async clearAllAccountData() {
    const d = await db();
    const tx = d.transaction(['accounts', 'sessions', 'trades', 'shots'], 'readwrite');
    await Promise.all([
      tx.objectStore('accounts').clear(),
      tx.objectStore('sessions').clear(),
      tx.objectStore('trades').clear(),
      tx.objectStore('shots').clear(),
      tx.done,
    ]);
  },
  async trades(): Promise<Trade[]> {
    return (await db()).getAll('trades');
  },
  async putTrade(t: Trade) {
    await (await db()).put('trades', t);
  },
  async commitClose(account: Account, session: SessionRec, trade: Trade) {
    const snapshot = structuredClone({ account, session, trade });
    const d = await db();
    const tx = d.transaction(['accounts', 'sessions', 'trades'], 'readwrite');
    await Promise.all([tx.objectStore('accounts').put(snapshot.account), tx.objectStore('sessions').put(snapshot.session), tx.objectStore('trades').put(snapshot.trade), tx.done]);
  },
  async sessions(): Promise<SessionRec[]> {
    return (await db()).getAll('sessions');
  },
  async putSession(s: SessionRec) {
    await (await db()).put('sessions', s);
  },
  async setups(): Promise<SetupRecord[]> {
    return (await db()).getAll('setups');
  },
  async putSetup(s: SetupRecord) {
    await (await db()).put('setups', s);
  },
  async shot(id: string): Promise<string | undefined> {
    return (await db()).get('shots', id);
  },
  async putShot(id: string, dataUrl: string) {
    await (await db()).put('shots', dataUrl, id);
  },
  async kv<T>(key: string): Promise<T | undefined> {
    return (await db()).get('kv', key);
  },
  async putKv(key: string, value: unknown) {
    await (await db()).put('kv', value, key);
  },
};

const STORES = ['accounts', 'trades', 'sessions', 'shots', 'kv', 'setups'] as const;

export async function exportBackup(): Promise<Blob> {
  const d = await db();
  const out: Record<string, unknown> = { app: 's2c', version: 2, exportedAt: Date.now() };
  const tx = d.transaction([...STORES], 'readonly');
  for (const s of STORES) {
    if (s === 'shots' || s === 'kv') {
      const keys = await tx.objectStore(s).getAllKeys();
      const vals = await tx.objectStore(s).getAll();
      out[s] = keys.map((k, i) => [k, vals[i]]);
    } else out[s] = await tx.objectStore(s).getAll();
  }
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}

export async function inspectBackup(file: File) {
  let data: Record<string, any>;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('Yedek dosyası okunamadı: geçerli bir JSON değil.'); }
  if (!data || data.app !== 's2c' || ![1, 2].includes(data.version)) throw new Error('Bu dosya desteklenen bir S2C yedeği değil.');
  if (data.version === 1) {
    const legacyId = 'legacy-setup';
    data.setups = [{ id: legacyId, name: 'İlk kurulum', note: 'Eski S2C yedeğinden aktarıldı.', createdAt: data.exportedAt ?? Date.now() }];
    for (const row of [...(data.accounts ?? []), ...(data.sessions ?? []), ...(data.trades ?? [])]) row.setupId ??= legacyId;
    data.kv ??= [];
    if (!data.kv.some((row: unknown) => Array.isArray(row) && row[0] === 'activeSetupId')) data.kv.push(['activeSetupId', legacyId]);
    data.version = 2;
  }
  for (const s of STORES) {
    if (!Array.isArray(data[s])) throw new Error(`Yedekte ${s} bölümü eksik veya geçersiz.`);
    if (s === 'shots' || s === 'kv') {
      if (data[s].some((row: unknown) => !Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string'))
        throw new Error(`Yedekte ${s} kayıtları geçersiz.`);
    } else if (data[s].some((row: any) => !row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id)) {
      throw new Error(`Yedekte ${s} kayıtları geçersiz.`);
    }
  }
  const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const setupIds = new Set<string>();
  for (const setup of data.setups) {
    if (setupIds.has(setup.id) || !setup.name?.trim() || !number(setup.createdAt) || typeof setup.note !== 'string') throw new Error('Yedekte geçersiz setup klasörü var.');
    setupIds.add(setup.id);
  }
  const activeSetup = data.kv.find((row: unknown) => Array.isArray(row) && row[0] === 'activeSetupId')?.[1];
  if (!setupIds.size || !setupIds.has(activeSetup)) throw new Error('Yedekte etkin setup klasörü bulunamadı.');
  const ids = new Set<string>();
  const accountSetups = new Map<string, string>();
  for (const a of data.accounts) {
    if (ids.has(a.id) || !setupIds.has(a.setupId) || !number(a.size) || a.size <= 0 || !number(a.balance) || !a.rules || typeof a.rules !== 'object' || !Array.isArray(a.tradingDays) || !Array.isArray(a.payouts)) throw new Error('Yedekte geçersiz veya tekrarlanan hesap var.');
    const rules = a.rules;
    if (!a.no || !['active','violated'].includes(a.status) || !['challenge','funded'].includes(a.phase) ||
        !number(a.createdAt) || !['target','dailyLoss','maxLoss','split'].every(k => number(rules[k]) && rules[k] > 0 && rules[k] <= 100) ||
        !Number.isInteger(rules.minDays) || rules.minDays < 0 || !number(rules.payoutMin) ||
        !a.tradingDays.every((day: unknown) => typeof day === 'string') ||
        !a.payouts.every((p: any) => p && p.accountId === a.id && number(p.amount) && number(p.gross) && number(p.at)))
      throw new Error('Hesap kuralları veya ödemeler geçersiz.');
    ids.add(a.id);
    accountSetups.set(a.id, a.setupId);
  }
  const sessionIds = new Set<string>();
  for (const s of data.sessions) {
    if (sessionIds.has(s.id) || !setupIds.has(s.setupId) || !ids.has(s.accountId) || !number(s.startMs) || !number(s.clockMs) || !Array.isArray(s.orders) || !Array.isArray(s.positions) || !Array.isArray(s.drawings)) throw new Error('Yedekte geçersiz seans var.');
    if (!number(s.dayStartEquity) || typeof s.dayKey !== 'string' ||
        !s.orders.every((o: any) => o && typeof o.id === 'string' && ['long','short'].includes(o.side) && ['limit','stop'].includes(o.type) && number(o.price) && number(o.lots) && o.lots > 0) ||
        !s.positions.every((p: any) => p && typeof p.id === 'string' && ['long','short'].includes(p.side) && number(p.entry) && number(p.openedAt) && number(p.lots) && p.lots > 0) ||
        !s.drawings.every((d: any) => d?.a && d.b && number(d.a.t) && number(d.a.p) && number(d.b.t) && number(d.b.p)))
      throw new Error('Seans detayları geçersiz.');
    sessionIds.add(s.id);
  }
  const owners = new Map(data.sessions.map((s: SessionRec) => [s.id, s.accountId]));
  const instrumentOk = (v: unknown) => v === undefined || isInstrumentId(v);
  if (!data.sessions.every((s: SessionRec) => instrumentOk(s.instrument)) || !data.trades.every((t: Trade) => instrumentOk(t.instrument))) throw new Error('Yedekte tanınmayan enstrüman var.');
  const tradeIds = new Set<string>();
  for (const t of data.trades) {
    if (tradeIds.has(t.id) || !setupIds.has(t.setupId) || !ids.has(t.accountId) || !sessionIds.has(t.sessionId) || !number(t.pnl) || !number(t.realClosedAt) || !number(t.entry) || !number(t.exit) || !number(t.lots) || t.lots <= 0 || !['long', 'short'].includes(t.side)) throw new Error('Yedekte geçersiz işlem var.');
    const session = data.sessions.find((s: SessionRec) => s.id === t.sessionId);
    if (owners.get(t.sessionId) !== t.accountId || accountSetups.get(t.accountId) !== t.setupId || session?.setupId !== t.setupId || !number(t.openedAt) || !number(t.closedAt) || t.closedAt < t.openedAt ||
        !['1m','5m','15m','1h','4h'].includes(t.tf)) throw new Error('İşlem ile seans bilgileri uyuşmuyor.');
    tradeIds.add(t.id);
  }
  return data;
}

export async function importBackup(file: File) {
  const data = await inspectBackup(file);
  const d = await db();
  const tx = d.transaction(STORES as unknown as string[], 'readwrite');
  for (const s of STORES) {
    const os = tx.objectStore(s);
    await os.clear();
    const rows = data[s];
    if (s === 'shots' || s === 'kv') for (const [k, v] of rows) await os.put(v, k);
    else for (const r of rows) await os.put(r);
  }
  await tx.done;
}
