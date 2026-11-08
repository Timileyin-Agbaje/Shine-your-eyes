// On-device storage for the wallet connection. The NWC string can spend the
// user's sats, so it is encrypted with AES-GCM under a non-extractable key that
// never leaves this browser, and it is never sent to our server.
// (A PIN-derived key replaces this in the hardening pass; see THREAT_MODEL.md #6.)

const DB_NAME = "sye";
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

const get = <T>(key: string) => run<T | undefined>("readonly", (s) => s.get(key));
const put = (key: string, value: unknown) => run<void>("readwrite", (s) => s.put(value, key));
const del = (key: string) => run<void>("readwrite", (s) => s.delete(key));

async function deviceKey(): Promise<CryptoKey> {
  const existing = await get<CryptoKey>("deviceKey");
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await put("deviceKey", key);
  return key;
}

export type SavedWallet = { url: string; isTest: boolean };

export async function saveWallet(wallet: SavedWallet): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(wallet));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await deviceKey(), data);
  await put("wallet", { iv, ct });
}

export async function loadWallet(): Promise<SavedWallet | undefined> {
  const sealed = await get<{ iv: Uint8Array<ArrayBuffer>; ct: ArrayBuffer }>("wallet");
  if (!sealed) return undefined;
  try {
    const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: sealed.iv }, await deviceKey(), sealed.ct);
    return JSON.parse(new TextDecoder().decode(data)) as SavedWallet;
  } catch {
    return undefined;
  }
}

export async function forgetWallet(): Promise<void> {
  await del("wallet");
}
