import { NWCClient } from "@getalby/sdk/nwc";

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
