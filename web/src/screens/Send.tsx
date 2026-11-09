import {
  type BtcRates,
  type Currency,
  decodeInvoice,
  type DecodeResult,
  evaluateRules,
  type Invoice,
  isSandboxInvoice,
  isSerious,
  type Warning,
} from "@sye/core";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Money } from "../components/Money.tsx";
import { RateNote } from "../components/RateNote.tsx";
import { canScan, Scanner } from "../components/Scanner.tsx";
import { Warnings } from "../components/Warnings.tsx";
import { faucetInvoice } from "../lib/faucet.ts";
import { hashPayee, loadHistory, recordPayment } from "../lib/history.ts";
import { checkPayment, payAndConfirm, type Wallet } from "../lib/wallet.ts";
import { strings } from "../strings.ts";

const s = strings.send;
const g = strings.guard;

/** Seconds "Pay anyway" stays disabled when warnings are serious (THREAT_MODEL #5). */
const PAY_ANYWAY_WAIT = 10;

type Props = {
  wallet: Wallet;
  balance: number | undefined;
  currency: Currency;
  rate: number | undefined;
  rates: BtcRates | undefined;
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

export function Send(props: Props) {
  const { wallet, balance, currency, rate, rates, rateAgeMs, pending, onPending, onBack, onSent } = props;
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [showMessage, setShowMessage] = useState(false);
  const [payee, setPayee] = useState<{ payee: string | undefined; hash: string | undefined }>();
  const [waitLeft, setWaitLeft] = useState(0);
  const [armed, setArmed] = useState(false);
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
  // A payment can be (re)tried only from idle or after a definite failure, and only
  // while the request is still valid and affordable.
  const canRetry = status === "idle" || status === "failed";
  const expired = invoice !== undefined && invoice.expiresAt * 1000 <= now;
  const notEnough = canRetry && invoice !== undefined && balance !== undefined && invoice.amountSats > balance;
  const minutesLeft = invoice ? Math.floor((invoice.expiresAt * 1000 - now) / 60_000) : 0;

  // Payee identity for the "new payee" rule; history only ever holds its hash.
  useEffect(() => {
    let cancelled = false;
    hashPayee(invoice?.payee).then((hash) => !cancelled && setPayee({ payee: invoice?.payee, hash }));
    return () => {
      cancelled = true;
    };
  }, [invoice?.payee]);

  // The rules run here, on the device, before anything else. Nothing later can remove them.
  const warnings: readonly Warning[] | undefined = useMemo(() => {
    if (!invoice || !payee || payee.payee !== invoice.payee) return undefined;
    return evaluateRules({
      invoice,
      message: message.trim() || undefined,
      rates,
      currency,
      history: loadHistory(wallet.id),
      payeeHash: payee.hash,
      now,
      localHour: new Date(now).getHours(),
    });
  }, [invoice, payee, message, rates, currency, now, wallet.id]);
  const serious = warnings !== undefined && isSerious(warnings);

  // With serious warnings, "Pay anyway" waits, then needs a second tap.
  useEffect(() => {
    setArmed(false);
    if (!serious) return setWaitLeft(0);
    setWaitLeft(PAY_ANYWAY_WAIT);
    const timer = setInterval(() => setWaitLeft((n) => (n <= 1 ? (clearInterval(timer), 0) : n - 1)), 1000);
    return () => clearInterval(timer);
  }, [serious, invoice?.paymentHash]);

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
    setNow(Date.now());
    setStatus(outcome);
    // Unknown results outlive this screen until the wallet gives an answer.
    onPending(outcome === "unknown" ? invoice : undefined);
    if (outcome === "sent") {
      hashPayee(invoice.payee).then((payeeHash) =>
        recordPayment(wallet.id, { payeeHash, sats: invoice.amountSats, at: Date.now() }),
      );
      onSent();
    }
  };

  const toPayment = (i: Invoice) => ({ invoice: i.raw, paymentHash: i.paymentHash, expiresAt: i.expiresAt });

  const pay = async () => {
    if (!invoice || !canRetry || expired || notEnough || inFlight.current) return;
    // `now` ticks every 15 s and pauses while locked, so check expiry against the real clock too.
    if (invoice.expiresAt * 1000 <= Date.now()) return setNow(Date.now());
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

  const payAnyway = () => {
    if (waitLeft > 0) return;
    if (!armed) return setArmed(true);
    setArmed(false);
    pay();
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
          {warnings && <Warnings warnings={warnings} />}
          {canRetry && (
            <div class="message-box">
              {showMessage || message ? (
                <>
                  <label for="message">{g.messageLabel}</label>
                  <textarea
                    id="message"
                    rows={4}
                    value={message}
                    placeholder={g.messagePlaceholder}
                    autocomplete="off"
                    onInput={(e) => setMessage(e.currentTarget.value)}
                  />
                  <p class="muted small">{g.messageStays}</p>
                </>
              ) : (
                <button type="button" class="btn btn--link" onClick={() => setShowMessage(true)}>
                  {g.addMessage}
                </button>
              )}
            </div>
          )}
          {canRetry && expired && <p class="error">{s.errors.expired}</p>}
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
          {!(status === "unknown" || status === "checking") &&
            (serious ? (
              <>
                <p class="muted">{g.seriousNote}</p>
                <button type="button" class="btn btn--primary btn--big" onClick={onBack} disabled={status === "paying"}>
                  {g.dontPay}
                </button>
                <button
                  type="button"
                  class={`btn btn--secondary${armed ? " btn--armed" : ""}`}
                  onClick={payAnyway}
                  disabled={!canRetry || expired || notEnough || waitLeft > 0}
                >
                  {status === "paying"
                    ? s.paying
                    : waitLeft > 0
                      ? g.payAnywayWait(waitLeft)
                      : armed
                        ? g.confirmPayAnyway
                        : g.payAnyway}
                </button>
              </>
            ) : (
              <button
                type="button"
                class="btn btn--primary"
                onClick={pay}
                disabled={!canRetry || expired || notEnough || !warnings}
              >
                {status === "paying" ? s.paying : s.pay}
              </button>
            ))}
        </section>
      )}
    </main>
  );
}
