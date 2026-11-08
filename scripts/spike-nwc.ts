// TIM-81 spike: one NWC sandbox wallet pays another over Lightning.
// Run with: pnpm spike:nwc
//
// Creates two dummy wallets on faucet.nwc.dev, makes an invoice on B, pays it
// from A, and prints timings and both balances. NWC strings can spend money, so
// they are never printed in full (see docs/THREAT_MODEL.md).

import { NWCClient } from "@getalby/sdk/nwc";

const FAUCET = "https://faucet.nwc.dev";
const START_SATS = 10_000;
const PAY_SATS = 2_100;

type Timing = { step: string; ms: number };
const timings: Timing[] = [];

async function timed<T>(step: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const ms = Math.round(performance.now() - start);
    timings.push({ step, ms });
    console.log(`  ${step}: ${ms} ms`);
  }
}

async function createWallet(balanceSats: number): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${FAUCET}?balance=${balanceSats}`, { method: "POST" });
    if (res.ok) return (await res.text()).trim();
    console.log(`  faucet returned ${res.status} (attempt ${attempt}), retrying`);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  throw new Error("faucet did not create a wallet after 3 attempts");
}

const mask = (url: string) => `${url.slice(0, 32)}…`;
const sats = (msats: number) => Math.floor(msats / 1000);

async function main() {
  console.log("Creating two sandbox wallets…");
  const urlA = await timed("create wallet A", () => createWallet(START_SATS));
  const urlB = await timed("create wallet B", () => createWallet(0));
  console.log(`  A: ${mask(urlA)}\n  B: ${mask(urlB)}`);

  const a = new NWCClient({ nostrWalletConnectUrl: urlA });
  const b = new NWCClient({ nostrWalletConnectUrl: urlB });

  try {
    console.log("\nget_info");
    const infoA = await timed("get_info A", () => a.getInfo());
    const infoB = await timed("get_info B", () => b.getInfo());
    console.log(`  network: ${infoA.network}, alias: ${infoA.alias || "(none)"}`);
    console.log(`  node pubkey A: ${infoA.pubkey}`);
    console.log(`  node pubkey B: ${infoB.pubkey}${infoA.pubkey === infoB.pubkey ? " (same node)" : ""}`);
    console.log(`  methods: ${infoA.methods.join(", ")}`);
    console.log(`  notifications: ${(infoA.notifications ?? []).join(", ") || "(none)"}`);
    if (infoB.methods.join() !== infoA.methods.join()) {
      console.log(`  B methods differ: ${infoB.methods.join(", ")}`);
    }

    console.log("\nBalances before");
    const beforeA = sats((await timed("get_balance A", () => a.getBalance())).balance);
    const beforeB = sats((await timed("get_balance B", () => b.getBalance())).balance);
    console.log(`  A: ${beforeA} sats, B: ${beforeB} sats`);

    let notifiedAt: number | undefined;
    const unsubscribe = await timed("subscribe B notifications", () =>
      b.subscribeNotifications((n) => {
        if (n.notification_type === "payment_received" && notifiedAt === undefined) {
          notifiedAt = performance.now();
        }
      }),
    );

    console.log(`\nB makes an invoice for ${PAY_SATS} sats (expiry 600 s)`);
    const invoice = await timed("make_invoice B", () =>
      b.makeInvoice({ amount: PAY_SATS * 1000, description: "Shine Your Eye spike", expiry: 600 }),
    );
    console.log(`  invoice: ${invoice.invoice.slice(0, 24)}… (${invoice.invoice.startsWith("lnbc") ? "mainnet prefix" : "non-mainnet prefix"})`);
    console.log(`  expires_at - created_at: ${invoice.expires_at - invoice.created_at} s`);

    console.log("\nA pays it");
    const paidStart = performance.now();
    const paid = await timed("pay_invoice A", () => a.payInvoice({ invoice: invoice.invoice }));
    console.log(`  fees_paid: ${paid.fees_paid} msats, preimage: ${paid.preimage ? "yes" : "no"}`);

    const lookup = await timed("lookup_invoice B", () => b.lookupInvoice({ payment_hash: invoice.payment_hash }));
    console.log(`  B sees state: ${lookup.state}, amount: ${sats(lookup.amount)} sats`);

    // Give the notification a few seconds to arrive.
    for (let i = 0; i < 20 && notifiedAt === undefined; i++) await new Promise((r) => setTimeout(r, 250));
    console.log(
      notifiedAt === undefined
        ? "  payment_received notification: not received within 5 s"
        : `  payment_received notification: ${Math.round(notifiedAt - paidStart)} ms after pay started`,
    );
    unsubscribe();

    console.log("\nBalances after");
    const afterA = sats((await a.getBalance()).balance);
    const afterB = sats((await b.getBalance()).balance);
    console.log(`  A: ${afterA} sats (${afterA - beforeA}), B: ${afterB} sats (+${afterB - beforeB})`);

    const ok = afterB - beforeB === PAY_SATS && beforeA - afterA >= PAY_SATS;
    console.log(`\n${ok ? "PASS" : "FAIL"}: B received ${afterB - beforeB} of ${PAY_SATS} sats`);
    console.log("\nTimings (ms):", Object.fromEntries(timings.map((t) => [t.step, t.ms])));
    if (!ok) process.exitCode = 1;
  } finally {
    a.close();
    b.close();
  }
}

// Relay sockets can outlive close(), so exit explicitly once we're done.
main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("\nFAIL:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
