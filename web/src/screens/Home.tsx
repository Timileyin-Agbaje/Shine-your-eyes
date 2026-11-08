import { CURRENCIES, type Currency } from "@sye/core";
import { Money } from "../components/Money.tsx";
import { RateNote } from "../components/RateNote.tsx";
import { strings } from "../strings.ts";

const s = strings.home;

type Props = {
  balance: number | undefined;
  balanceError: boolean;
  isTest: boolean;
  currency: Currency;
  rate: number | undefined;
  rateAgeMs: number | undefined;
  onCurrency: (c: Currency) => void;
  onRefresh: () => void;
  onSend: () => void;
  onReceive: () => void;
  onDisconnect: () => void;
};

const LABELS: Record<Currency, string> = { NGN: "₦ Naira", XOF: "CFA franc" };

export function Home(p: Props) {
  return (
    <main class="screen">
      <section class="card balance" aria-live="polite">
        <div class="row">
          <h2>{s.balance}</h2>
          {p.isTest && <span class="badge">{s.testBadge}</span>}
        </div>
        {p.balance === undefined ? (
          p.balanceError ? (
            <div>
              <p class="error">{s.balanceError}</p>
              <button type="button" class="btn btn--secondary" onClick={p.onRefresh}>
                {s.refresh}
              </button>
            </div>
          ) : (
            <p class="muted">{strings.loading}</p>
          )
        ) : (
          <Money sats={p.balance} currency={p.currency} rate={p.rate} size="big" />
        )}
        <RateNote rate={p.rate} rateAgeMs={p.rateAgeMs} />
      </section>

      <div class="actions">
        <button type="button" class="btn btn--primary" onClick={p.onSend}>
          {s.send}
        </button>
        <button type="button" class="btn btn--primary" onClick={p.onReceive}>
          {s.receive}
        </button>
      </div>

      <section class="settings">
        <fieldset class="segmented">
          <legend>{s.showIn}</legend>
          {CURRENCIES.map((c) => (
            <label key={c} class={c === p.currency ? "is-on" : ""}>
              <input type="radio" name="currency" checked={c === p.currency} onChange={() => p.onCurrency(c)} />
              {LABELS[c]}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          class="btn btn--link"
          onClick={() => {
            if (confirm(s.disconnectConfirm)) p.onDisconnect();
          }}
        >
          {s.disconnect}
        </button>
      </section>
    </main>
  );
}
