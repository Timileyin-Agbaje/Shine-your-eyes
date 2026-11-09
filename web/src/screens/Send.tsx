import { type Currency, decodeInvoice, type DecodeResult, type Invoice, isSandboxInvoice } from "@sye/core";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Money } from "../components/Money.tsx";
import { RateNote } from "../components/RateNote.tsx";
import { canScan, Scanner } from "../components/Scanner.tsx";
import { faucetInvoice } from "../lib/faucet.ts";
import { checkPayment, payAndConfirm, type Wallet } from "../lib/wallet.ts";
import { strings } from "../strings.ts";

const s = strings.send;

type Props = {
  wallet: Wallet;
  balance: number | undefined;
  currency: Currency;
  rate: number | undefined;
  rateAgeMs: number | undefined;
  /** A payment whose result was unknown when the user last left this screen. */
  pending: Invoice | undefined;
  onPending: (invoice: Invoice | undefined) => void;
  onBack: () => void;
  onSent: () => void;
};

type Status = "idle" | "paying" | "sent" | "failed" | "unknown" | "checking";

function check(text: string, isTest: boolean, nowMs: number): DecodeResult | undefined {
  if (!text.trim()) return undefined;
  const result = decodeInvoice(text, Math.floor(nowMs / 1000));
  if (result.ok && isTest && !isSandboxInvoice(result.invoice)) return { ok: false, error: "not_sandbox" };
  return result;
}

export function Send({ wallet, balance, currency, rate, rateAgeMs, pending, onPending, onBack, onSent }: Props) {
  const [text, setText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<Status>(pending ? "unknown" : "idle");
  // The invoice being paid is frozen here, so editing the box can't change what we report.
  const [paying, setPaying] = useState<Invoice | undefined>(pending);
  const [now, setNow] = useState(() => Date.now());
  const [helperBusy, setHelperBusy] = useState(false);
  // Set synchronously on the first tap, so a fast double tap can't pay twice.
  const inFlight = useRef(false);
  // Only the latest pay/check attempt may report a result.
  const attempt = useRef(0);

  const locked = status === "paying" || status === "unknown" || status === "checking";
  const result = useMemo(() => check(text, wallet.isTest, now), [text, wallet.isTest, now]);

  // Keep the expiry countdown honest while the screen is open.
  useEffect(() => {
    if (locked) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [locked]);

  // Once a payment has started, keep showing that invoice until the user edits the box,
  // so its final result (even "failed") stays on screen.
  const frozen = status !== "idle";
  const invoice = frozen ? paying : result?.ok ? result.invoice : undefined;
  const notEnough = !frozen && invoice !== undefined && balance !== undefined && invoice.amountSats > balance;
  const minutesLeft = invoice ? Math.floor((invoice.expiresAt * 1000 - now) / 60_000) : 0;

  const edit = (value: string) => {
    if (locked) return;
    setText(value);
    setStatus("idle");
  };

  const pasteFromClipboard = async () => {
    try {
      edit(await navigator.clipboard.readText());
    } catch {}
  };

  const getTestInvoice = async () => {
    setHelperBusy(true);
    try {
      edit(await faucetInvoice(1000, "Test payment"));
    } catch {
    } finally {
      setHelperBusy(false);
    }
  };

  const settle = (outcome: "sent" | "failed" | "unknown", invoice: Invoice, id: number) => {
    if (id !== attempt.current) return;
    setStatus(outcome);
    // Unknown results outlive this screen until the wallet gives an answer.
    onPending(outcome === "unknown" ? invoice : undefined);
    if (outcome === "sent") onSent();
  };

  const toPayment = (i: Invoice) => ({ invoice: i.raw, paymentHash: i.paymentHash, expiresAt: i.expiresAt });

  const pay = async () => {
    if (!invoice || notEnough || locked || inFlight.current) return;
    inFlight.current = true;
    const id = ++attempt.current;
    setPaying(invoice);
    setStatus("paying");
    try {
      settle(await payAndConfirm(wallet, toPayment(invoice)), invoice, id);
    } finally {
      inFlight.current = false;
    }
  };

  const recheck = async () => {
    if (!paying || inFlight.current) return;
    inFlight.current = true;
    const id = ++attempt.current;
    setStatus("checking");
    try {
      settle(await checkPayment(wallet, toPayment(paying)), paying, id);
    } finally {
      inFlight.current = false;
    }
  };

  if (status === "sent" && paying) {
    return (
      <main class="screen">
        <section class="card center">
          <p class="success" role="status">
            ✓ {s.sent}
          </p>
          <Money sats={paying.amountSats} currency={currency} rate={rate} size="big" />
          <button type="button" class="btn btn--primary" onClick={onBack}>
            {s.done}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main class="screen">
      <header class="bar">
        <button type="button" class="btn btn--link" onClick={onBack} disabled={status === "paying"}>
          ← {strings.back}
        </button>
        <h1>{s.title}</h1>
      </header>

      <section class="card">
        <label for="invoice">{s.pasteLabel}</label>
        <textarea
          id="invoice"
          rows={4}
          value={locked ? (paying?.raw ?? text) : text}
          readOnly={locked}
          placeholder={s.pastePlaceholder}
          autocomplete="off"
          spellcheck={false}
          onInput={(e) => edit(e.currentTarget.value)}
        />
        <div class="actions">
          <button type="button" class="btn btn--secondary" onClick={pasteFromClipboard} disabled={locked}>
            {s.paste}
          </button>
          {canScan && (
            <button type="button" class="btn btn--secondary" onClick={() => setScanning(true)} disabled={locked}>
              {s.scan}
            </button>
          )}
        </div>
        {wallet.isTest && (
          <button type="button" class="btn btn--link" onClick={getTestInvoice} disabled={helperBusy || locked}>
            {s.getTestInvoice}
          </button>
        )}
        {scanning && !locked && (
          <Scanner
            onScan={(value) => {
              edit(value);
              setScanning(false);
            }}
            onClose={() => setScanning(false)}
          />
        )}
      </section>

      {!locked && result && !result.ok && (
        <p class="error" role="alert">
          {s.errors[result.error]}
        </p>
      )}

      {invoice && (
        <section class="card" aria-live="polite">
          <h2>{s.youArePaying}</h2>
          <Money sats={invoice.amountSats} currency={currency} rate={rate} size="big" />
          <RateNote rate={rate} rateAgeMs={rateAgeMs} />
          <dl class="facts">
            <dt>{s.forLabel}</dt>
            {/* Rendered as plain text: invoice descriptions are untrusted. */}
            <dd>{invoice.description || s.noDescription}</dd>
          </dl>
          {!locked && <p class="muted">{s.expiresIn(minutesLeft)}</p>}
          {notEnough && <p class="error">{s.notEnough}</p>}
          {status === "failed" && (
            <p class="error" role="alert">
              {s.failed}
            </p>
          )}
          {(status === "unknown" || status === "checking") && (
            <>
              <p class="error" role="alert">
                {s.unknown}
              </p>
              <button type="button" class="btn btn--secondary" onClick={recheck} disabled={status === "checking"}>
                {status === "checking" ? s.checking : s.checkAgain}
              </button>
            </>
          )}
          {!(status === "unknown" || status === "checking") && (
            <button type="button" class="btn btn--primary" onClick={pay} disabled={locked || notEnough}>
              {status === "paying" ? s.paying : s.pay}
            </button>
          )}
        </section>
      )}
    </main>
  );
}
