import type { DatabaseSync } from "node:sqlite";
import { type BtcRates, CURRENCIES, type RatesResponse } from "@sye/core";
import { z } from "zod";

const REFRESH_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const RETRY_MS = 60 * 1000;

type Source = { name: string; fetch: () => Promise<BtcRates> };

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const positive = z.number().positive();

const coingecko: Source = {
  name: "coingecko",
  async fetch() {
    const body = z
      .object({ bitcoin: z.object({ ngn: positive, xof: positive }) })
      .parse(await getJson("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=ngn,xof"));
    return { NGN: body.bitcoin.ngn, XOF: body.bitcoin.xof };
  },
};

const alby: Source = {
  name: "alby",
  async fetch() {
    const one = async (c: string) =>
      z.object({ rate_float: positive }).parse(await getJson(`https://getalby.com/api/rates/${c}.json`)).rate_float;
    const [NGN, XOF] = await Promise.all([one("ngn"), one("xof")]);
    return { NGN, XOF };
  },
};

/** RATES_FIXED="NGN:102000000,XOF:44600000" pins rates (used by the e2e suite). */
function fixedSource(spec: string): Source {
  const rates = Object.fromEntries(spec.split(",").map((pair) => pair.split(":")).map(([c, r]) => [c, Number(r)]));
  return { name: "fixed", fetch: async () => z.object({ NGN: positive, XOF: positive }).parse(rates) };
}

/**
 * BTC prices in local money, cached in SQLite. Refreshes at most every 5 minutes,
 * tries a second source if the first fails, and falls back to the last good
 * rates (the client shows their age).
 */
export function createRates(db: DatabaseSync, fixed = process.env.RATES_FIXED) {
  db.exec(`CREATE TABLE IF NOT EXISTS rates (
    currency TEXT PRIMARY KEY,
    rate REAL NOT NULL,
    fetched_at INTEGER NOT NULL,
    source TEXT NOT NULL
  )`);
  const sources = fixed ? [fixedSource(fixed)] : [coingecko, alby];
  const upsert = db.prepare(
    "INSERT INTO rates (currency, rate, fetched_at, source) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(currency) DO UPDATE SET rate = excluded.rate, fetched_at = excluded.fetched_at, source = excluded.source",
  );
  const select = db.prepare("SELECT currency, rate, fetched_at, source FROM rates");

  let inflight: Promise<void> | undefined;
  let lastAttempt = 0;

  function cached(): RatesResponse | undefined {
    const rows = select.all() as { currency: string; rate: number; fetched_at: number; source: string }[];
    const rates: Partial<BtcRates> = {};
    for (const row of rows) rates[row.currency as keyof BtcRates] = row.rate;
    if (!CURRENCIES.every((c) => rates[c] !== undefined)) return undefined;
    return {
      rates: rates as BtcRates,
      fetchedAt: Math.min(...rows.map((r) => r.fetched_at)),
      source: rows[0]!.source,
    };
  }

  async function refresh() {
    for (const source of sources) {
      try {
        const rates = await source.fetch();
        const now = Date.now();
        for (const c of CURRENCIES) upsert.run(c, rates[c], now, source.name);
        return;
      } catch (err) {
        console.warn(`rates: ${source.name} failed (${err instanceof Error ? err.message : "error"})`);
      }
    }
  }

  return {
    async get(): Promise<RatesResponse | undefined> {
      const current = cached();
      const stale = !current || Date.now() - current.fetchedAt > REFRESH_MS;
      // When every source is down, don't make each request wait on timeouts.
      if (stale && (!current || Date.now() - lastAttempt > RETRY_MS)) {
        lastAttempt = Date.now();
        inflight ??= refresh().finally(() => (inflight = undefined));
        await inflight;
      }
      return cached();
    },
  };
}
