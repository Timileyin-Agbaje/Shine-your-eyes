import { type Currency, fiatToSats, formatFiat, formatSats, parseAmountInput, satsToFiat } from "@sye/core";
import { useEffect, useMemo, useState } from "preact/hooks";
import { renderSVG } from "uqr";
import { Money } from "../components/Money.tsx";
import { RateNote } from "../components/RateNote.tsx";
import { faucetPay } from "../lib/faucet.ts";
import { type Wallet, withTimeout } from "../lib/wallet.ts";
import { strings } from "../strings.ts";

const s = strings.receive;

type Props = {
  wallet: Wallet;
  currency: Currency;
  rate: number | undefined;
  rateAgeMs: number | undefined;
  onBack: () => void;
  onPaid: () => void;
};
type Request = { invoice: string; paymentHash: string; sats: number };

export function Receive({ wallet, currency, rate, rateAgeMs, onBack, onPaid }: Props) {
  const [unit, setUnit] = useState<"fiat" | "sats">(rate === undefined ? "sats" : "fiat");
  const [amount, setAmount] = useState("");
  const [request, setRequest] = useState<Request | undefined>();
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [faucetBusy, setFaucetBusy] = useState(false);

  // Without a rate, amounts can only be typed in sats.
  const inSats = unit === "sats" || rate === undefined;
  const value = parseAmountInput(amount, { decimals: !inSats });
  const sats = value === undefined ? undefined : inSats ? value : fiatToSats(value, rate!);

  const create = async (e: Event) => {
    e.preventDefault();
    if (value === undefined || sats === undefined) return setError(inSats ? s.badSats : s.badAmount);
    if (sats < 1) return setError(s.tooSmall);
    setBusy(true);
    setError(undefined);
    try {
      const tx = await withTimeout(
        wallet.client.makeInvoice({ amount: sats * 1000, description: "Shine Your Eye", expiry: 3600 }),
        20_000,
      );
      setRequest({ invoice: tx.invoice, paymentHash: tx.payment_hash, sats });
    } catch {
      setError(s.error);
    } finally {
      setBusy(false);
    }
  };

  // Watch for the payment: wallet notifications when supported, polling as a backstop.
  useEffect(() => {
    if (!request || paid) return;
    let done = false;
    const markPaid = () => {
      if (done) return;
      done = true;
      setPaid(true);
      onPaid();
    };
    let unsubscribe: (() => void) | undefined;
    wallet.client
      .subscribeNotifications((n) => {
        if (n.notification_type === "payment_received" && n.notification.payment_hash === request.paymentHash) markPaid();
      }, ["payment_received"])
      .then((unsub) => (done ? unsub() : (unsubscribe = unsub)))
      .catch(() => {});
    const timer = setInterval(async () => {
      try {
        const tx = await wallet.client.lookupInvoice({ payment_hash: request.paymentHash });
        if (tx.state === "settled") markPaid();
      } catch {}
    }, 3000);
    return () => {
      done = true;
      clearInterval(timer);
      unsubscribe?.();
    };
  }, [request, paid]);

  const qr = useMemo(() => (request ? renderSVG(request.invoice.toUpperCase(), { border: 2 }) : ""), [request]);

  const copy = async () => {
    if (!request) return;
    try {
      await navigator.clipboard.writeText(request.invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const share = async () => {
    if (!request) return;
    const text = `${s.shareText} ${request.invoice}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {}
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    }
  };

  const payFromFaucet = async () => {
    if (!request) return;
    setFaucetBusy(true);
    try {
      await faucetPay(request.invoice);
    } catch {
      setError(s.error);
    } finally {
      setFaucetBusy(false);
    }
  };

  return (
    <main class="screen">
      <header class="bar">
        <button type="button" class="btn btn--link" onClick={onBack}>
          ← {strings.back}
        </button>
        <h1>{s.title}</h1>
      </header>

      {!request ? (
        <form class="card" onSubmit={create}>
          <label for="amount">{s.amountLabel}</label>
          <div class="amount-input">
            <input
              id="amount"
              inputMode="decimal"
              autocomplete="off"
              value={amount}
              onInput={(e) => setAmount(e.currentTarget.value)}
              placeholder="0"
            />
            {rate !== undefined ? (
              <button
                type="button"
                class="btn btn--small"
                onClick={() => setUnit(unit === "fiat" ? "sats" : "fiat")}
                aria-label="Switch unit"
              >
                {inSats ? "sats" : currency === "NGN" ? "₦" : "CFA"} ⇄
              </button>
            ) : (
              <span class="unit">sats</span>
            )}
          </div>
          {sats !== undefined && sats > 0 && (
            <p class="muted">
              = {inSats ? (rate !== undefined ? `≈ ${formatFiat(satsToFiat(sats, rate), currency)}` : formatSats(sats)) : formatSats(sats)}
            </p>
          )}
          <RateNote rate={rate} rateAgeMs={rateAgeMs} />
          <button type="submit" class="btn btn--primary" disabled={busy}>
            {busy ? s.creating : s.create}
          </button>
        </form>
      ) : (
        <section class="card center">
          <Money sats={request.sats} currency={currency} rate={rate} size="big" />
          {paid ? (
            <p class="success" role="status">
              ✓ {s.paid}
            </p>
          ) : (
            <>
              {/* Generated locally from the invoice string; contains no user text. */}
              <div class="qr" dangerouslySetInnerHTML={{ __html: qr }} />
              <p class="muted" role="status">
                {s.waiting}
              </p>
              <div class="actions">
                <button type="button" class="btn btn--secondary" onClick={copy}>
                  {copied ? s.copied : s.copy}
                </button>
                <button type="button" class="btn btn--secondary" onClick={share}>
                  {s.share}
                </button>
              </div>
              {wallet.isTest && (
                <button type="button" class="btn btn--link" onClick={payFromFaucet} disabled={faucetBusy}>
                  {faucetBusy ? s.paying : s.payFromFaucet}
                </button>
              )}
            </>
          )}
        </section>
      )}

      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
