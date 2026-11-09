import { openDB, IDBPDatabase } from 'idb';
import type { Account, SessionRec, Trade } from './types';

const DB = 's2c';
let dbp: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbp)
    dbp = openDB(DB, 1, {
      upgrade(d) {
        d.createObjectStore('accounts', { keyPath: 'id' });
        const t = d.createObjectStore('trades', { keyPath: 'id' });
        t.createIndex('accountId', 'accountId');
        d.createObjectStore('sessions', { keyPath: 'id' });
        d.createObjectStore('shots');
        d.createObjectStore('kv');
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
  async trades(): Promise<Trade[]> {
    return (await db()).getAll('trades');
  },
  async putTrade(t: Trade) {
    await (await db()).put('trades', t);
  },
  async sessions(): Promise<SessionRec[]> {
    return (await db()).getAll('sessions');
  },
  async putSession(s: SessionRec) {
    await (await db()).put('sessions', s);
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

const STORES = ['accounts', 'trades', 'sessions', 'shots', 'kv'] as const;

export async function exportBackup(): Promise<Blob> {
  const d = await db();
  const out: Record<string, unknown> = { app: 's2c', version: 1, exportedAt: Date.now() };
  for (const s of STORES) {
    if (s === 'shots' || s === 'kv') {
      const keys = await d.getAllKeys(s);
      const vals = await d.getAll(s);
      out[s] = keys.map((k, i) => [k, vals[i]]);
    } else out[s] = await d.getAll(s);
  }
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text());
  if (data.app !== 's2c') throw new Error('Bu dosya bir S2C yedeği değil.');
  const d = await db();
  const tx = d.transaction(STORES as unknown as string[], 'readwrite');
  for (const s of STORES) {
    const os = tx.objectStore(s);
    await os.clear();
    const rows = data[s] ?? [];
    if (s === 'shots' || s === 'kv') for (const [k, v] of rows) await os.put(v, k);
    else for (const r of rows) await os.put(r);
  }
  await tx.done;
}
