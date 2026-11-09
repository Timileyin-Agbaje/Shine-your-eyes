import { Nip47WalletError, NWCClient } from "@getalby/sdk/nwc";

export type Wallet = { client: NWCClient; isTest: boolean };

export function openWallet(url: string, isTest: boolean): Wallet {
  return { client: new NWCClient({ nostrWalletConnectUrl: url }), isTest };
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/** Balance in sats, keeping fractions of a sat (wallets report msats). */
export async function balanceSats(wallet: Wallet): Promise<number> {
  const { balance } = await withTimeout(wallet.client.getBalance(), 15_000);
  return balance / 1000;
}

export type PayOutcome = "sent" | "failed" | "unknown";

type Payment = { invoice: string; paymentHash: string; /** unix seconds */ expiresAt: number };

/**
 * Pays and reports what really happened. Only an explicit refusal from the
 * wallet counts as "failed". A timeout means the request may still be on its
 * way through the relay, so the result is "unknown" until the wallet says
 * otherwise or the invoice expires.
 */
export async function payAndConfirm(wallet: Wallet, payment: Payment): Promise<PayOutcome> {
  try {
    await withTimeout(wallet.client.payInvoice({ invoice: payment.invoice }), 60_000);
    return "sent";
  } catch (err) {
    return checkPayment(wallet, payment, { refused: err instanceof Nip47WalletError });
  }
}

export async function checkPayment(
  wallet: Wallet,
  payment: Payment,
  { refused = false }: { refused?: boolean } = {},
): Promise<PayOutcome> {
  try {
    const tx = await withTimeout(wallet.client.lookupInvoice({ payment_hash: payment.paymentHash }), 15_000);
    if (tx.state === "settled") return "sent";
    if (tx.state === "failed") return "failed";
    return "unknown";
  } catch (err) {
    const notFound = err instanceof Nip47WalletError && err.code === "NOT_FOUND";
    // No record of the payment, and it can no longer happen: the wallet refused
    // it outright, or the invoice has expired so a late request can't be paid.
    const expired = payment.expiresAt * 1000 < Date.now();
    if (notFound && (refused || expired)) return "failed";
    return "unknown";
  }
}
