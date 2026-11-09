// The NWC faucet hands out dummy wallets on one Alby Hub node. Its invoices look
// like mainnet ones (lnbc…), so we tell sandbox invoices apart by payee node.
// See docs/SPIKES.md.

export const FAUCET_URL = "https://faucet.nwc.dev";
export const FAUCET_NODE_PUBKEY = "03b6b08ea1f2b70f2260886c9b28fed115b833f18c227abdbf0e8d0629d42b430c";

/** True when the invoice was issued by the faucet node, i.e. it only moves sandbox sats. */
export function isSandboxInvoice(invoice: { payee: string | undefined }): boolean {
  return invoice.payee === FAUCET_NODE_PUBKEY;
}
