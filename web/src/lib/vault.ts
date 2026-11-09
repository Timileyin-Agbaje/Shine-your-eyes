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

/** Runs one request and resolves only once its transaction has committed. */
async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
  }).finally(() => db.close());
}

const get = <T>(key: string) => run<T | undefined>("readonly", (s) => s.get(key));
const put = (key: string, value: unknown) => run<void>("readwrite", (s) => s.put(value, key));
const del = (key: string) => run<void>("readwrite", (s) => s.delete(key));

/**
 * The device key. Creation is atomic: a candidate key is stored with `add`
 * inside one readwrite transaction, so if two tabs race, one add fails and
 * both end up using the key that was stored first.
 */
async function deviceKey(): Promise<CryptoKey> {
  const existing = await get<CryptoKey>("deviceKey");
  if (existing) return existing;
  const candidate = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const db = await openDb();
  try {
    return await new Promise<CryptoKey>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let key: CryptoKey | undefined;
      const read = store.get("deviceKey");
      read.onsuccess = () => {
        key = read.result as CryptoKey | undefined;
        if (!key) {
          key = candidate;
          store.add(candidate, "deviceKey");
        }
      };
      tx.oncomplete = () => resolve(key!);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
    });
  } finally {
    db.close();
  }
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
