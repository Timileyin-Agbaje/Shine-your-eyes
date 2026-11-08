import { decode } from "light-bolt11-decoder";

export type Network = "mainnet" | "testnet" | "signet" | "regtest";

export type Invoice = {
  raw: string;
  network: Network;
  /** May include a fraction of a sat (amountMsat / 1000); never rounded. */
  amountSats: number;
  amountMsat: number;
  description: string;
  paymentHash: string;
  /** Payee node pubkey, when the invoice carries it (the `n` tag). */
  payee: string | undefined;
  /** Unix seconds. */
  createdAt: number;
  /** Unix seconds. */
  expiresAt: number;
};

export type InvoiceError = "malformed" | "no_amount" | "expired" | "not_sandbox";

export type DecodeResult = { ok: true; invoice: Invoice } | { ok: false; error: InvoiceError };

const PREFIX_NETWORK: [string, Network][] = [
  ["lnbcrt", "regtest"],
  ["lntbs", "signet"],
  ["lntb", "testnet"],
  ["lnbc", "mainnet"],
];

/** Accepts a raw BOLT11 string, optionally prefixed with "lightning:". */
export function normalizeInvoice(input: string): string {
  return input.trim().replace(/^lightning:/i, "").toLowerCase();
}

/**
 * Strictly decodes a BOLT11 invoice. Rejects anything malformed, amountless or
 * expired, so the amount we show is always the amount that gets paid.
 */
export function decodeInvoice(input: string, nowSeconds = Math.floor(Date.now() / 1000)): DecodeResult {
  const raw = normalizeInvoice(input);
  const network = PREFIX_NETWORK.find(([prefix]) => raw.startsWith(prefix))?.[1];
  if (!network) return { ok: false, error: "malformed" };

  let decoded: ReturnType<typeof decode>;
  try {
    decoded = decode(raw);
  } catch {
    return { ok: false, error: "malformed" };
  }

  const section = (name: string) =>
    (decoded.sections as { name: string; value?: unknown }[]).find((s) => s.name === name)?.value;

  const amountMsat = Number(section("amount") ?? 0);
  const paymentHash = section("payment_hash");
  const timestamp = section("timestamp");
  if (typeof paymentHash !== "string" || typeof timestamp !== "number") return { ok: false, error: "malformed" };
  if (!Number.isSafeInteger(amountMsat) || amountMsat <= 0) return { ok: false, error: "no_amount" };

  const expiresAt = timestamp + (decoded.expiry ?? 3600);
  if (expiresAt <= nowSeconds) return { ok: false, error: "expired" };

  const description = section("description");
  const payee = section("payee");

  return {
    ok: true,
    invoice: {
      raw,
      network,
      amountMsat,
      amountSats: amountMsat / 1000,
      description: typeof description === "string" ? description : "",
      paymentHash,
      payee: typeof payee === "string" ? payee : undefined,
      createdAt: timestamp,
      expiresAt,
    },
  };
}
