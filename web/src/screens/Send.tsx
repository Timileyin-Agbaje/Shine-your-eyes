import { type Currency, decodeInvoice, type DecodeResult, isSandboxInvoice } from "@sye/core";
import { useEffect, useMemo, useState } from "preact/hooks";
import { Money } from "../components/Money.tsx";
import { canScan, Scanner } from "../components/Scanner.tsx";
import { faucetInvoice } from "../lib/faucet.ts";
import { type Wallet, withTimeout } from "../lib/wallet.ts";
import { strings } from "../strings.ts";

const s = strings.send;

type Props = {
  wallet: Wallet;
  balance: number | undefined;
  currency: Currency;
  rate: number | undefined;
  onBack: () => void;
  onSent: () => void;
};

function check(text: string, isTest: boolean): DecodeResult | undefined {
  if (!text.trim()) return undefined;
  const result = decodeInvoice(text);
  if (result.ok && isTest && !isSandboxInvoice(result.invoice)) return { ok: false, error: "not_sandbox" };
  return result;
}

export function Send({ wallet, balance, currency, rate, onBack, onSent }: Props) {
  const [text, setText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<"idle" | "paying" | "sent" | "failed">("idle");
  const [now, setNow] = useState(() => Date.now());
  const [helperBusy, setHelperBusy] = useState(false);

  const result = useMemo(() => check(text, wallet.isTest), [text, wallet.isTest, now]);

  // Keep the expiry countdown honest while the screen is open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const invoice = result?.ok ? result.invoice : undefined;
  const notEnough = invoice !== undefined && balance !== undefined && invoice.amountSats > balance;
  const minutesLeft = invoice ? Math.floor((invoice.expiresAt * 1000 - now) / 60_000) : 0;

  const pasteFromClipboard = async () => {
    try {
      setText(await navigator.clipboard.readText());
    } catch {}
  };

  const getTestInvoice = async () => {
    setHelperBusy(true);
    try {
      setText(await faucetInvoice(1000, "Test payment"));
    } catch {
    } finally {
      setHelperBusy(false);
    }
  };

  const pay = async () => {
    if (!invoice || notEnough) return;
    setStatus("paying");
    try {
      await withTimeout(wallet.client.payInvoice({ invoice: invoice.raw }), 60_000);
      setStatus("sent");
      onSent();
    } catch {
      setStatus("failed");
    }
  };

  if (status === "sent" && invoice) {
    return (
      <main class="screen">
        <section class="card center">
          <p class="success" role="status">
            ✓ {s.sent}
          </p>
          <Money sats={invoice.amountSats} currency={currency} rate={rate} size="big" />
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
        <button type="button" class="btn btn--link" onClick={onBack}>
          ← {strings.back}
        </button>
        <h1>{s.title}</h1>
      </header>

      <section class="card">
        <label for="invoice">{s.pasteLabel}</label>
        <textarea
          id="invoice"
          rows={4}
          value={text}
          placeholder={s.pastePlaceholder}
          autocomplete="off"
          spellcheck={false}
          onInput={(e) => {
            setText(e.currentTarget.value);
            setStatus("idle");
          }}
        />
        <div class="actions">
          <button type="button" class="btn btn--secondary" onClick={pasteFromClipboard}>
            {s.paste}
          </button>
          {canScan && (
            <button type="button" class="btn btn--secondary" onClick={() => setScanning(true)}>
              {s.scan}
            </button>
          )}
        </div>
        {wallet.isTest && (
          <button type="button" class="btn btn--link" onClick={getTestInvoice} disabled={helperBusy}>
            {s.getTestInvoice}
          </button>
        )}
        {scanning && (
          <Scanner
            onScan={(value) => {
              setText(value);
              setScanning(false);
            }}
            onClose={() => setScanning(false)}
          />
        )}
      </section>

      {result && !result.ok && (
        <p class="error" role="alert">
          {s.errors[result.error]}
        </p>
      )}

      {invoice && (
        <section class="card" aria-live="polite">
          <h2>{s.youArePaying}</h2>
          <Money sats={invoice.amountSats} currency={currency} rate={rate} size="big" />
          <dl class="facts">
            <dt>{s.forLabel}</dt>
            {/* Rendered as plain text: invoice descriptions are untrusted. */}
            <dd>{invoice.description || s.noDescription}</dd>
          </dl>
          <p class="muted">{s.expiresIn(minutesLeft)}</p>
          {notEnough && <p class="error">{s.notEnough}</p>}
          {status === "failed" && (
            <p class="error" role="alert">
              {s.failed}
            </p>
          )}
          <button
            type="button"
            class="btn btn--primary"
            onClick={pay}
            disabled={status === "paying" || notEnough}
          >
            {status === "paying" ? s.paying : s.pay}
          </button>
        </section>
      )}
    </main>
  );
}
