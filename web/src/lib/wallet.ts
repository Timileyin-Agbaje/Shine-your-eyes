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

export async function balanceSats(wallet: Wallet): Promise<number> {
  const { balance } = await withTimeout(wallet.client.getBalance(), 15_000);
  return Math.floor(balance / 1000);
}

export type PayOutcome = "sent" | "failed" | "unknown";

/**
 * Pays and reports what really happened. A timeout or error from pay_invoice
 * doesn't prove the money stayed put, so we ask the wallet before saying "failed".
 */
export async function payAndConfirm(wallet: Wallet, invoice: string, paymentHash: string): Promise<PayOutcome> {
  try {
    await withTimeout(wallet.client.payInvoice({ invoice }), 60_000);
    return "sent";
  } catch {
    return checkPayment(wallet, paymentHash);
  }
}

export async function checkPayment(wallet: Wallet, paymentHash: string): Promise<PayOutcome> {
  try {
    const tx = await withTimeout(wallet.client.lookupInvoice({ payment_hash: paymentHash }), 15_000);
    if (tx.state === "settled") return "sent";
    if (tx.state === "failed") return "failed";
    return "unknown";
  } catch (err) {
    // The wallet has no record of this payment, so nothing was sent.
    if (err instanceof Nip47WalletError && err.code === "NOT_FOUND") return "failed";
    return "unknown";
  }
}
