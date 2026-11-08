import { type Currency, RatesResponse } from "@sye/core";
import { useEffect, useState } from "preact/hooks";

const RATES_KEY = "sye.rates";
const CURRENCY_KEY = "sye.currency";

function readCached(): RatesResponse | undefined {
  try {
    const parsed = RatesResponse.safeParse(JSON.parse(localStorage.getItem(RATES_KEY) ?? "null"));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Latest BTC rates from our server, falling back to the last ones we saw. */
export function useRates(): RatesResponse | undefined {
  const [rates, setRates] = useState<RatesResponse | undefined>(readCached);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/rates");
        const parsed = RatesResponse.safeParse(await res.json());
        if (!parsed.success || cancelled) return;
        setRates(parsed.data);
        try {
          localStorage.setItem(RATES_KEY, JSON.stringify(parsed.data));
        } catch {}
      } catch {
        // Offline or server down: keep showing the cached rate with its age.
      }
    };
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  return rates;
}

export function loadCurrency(): Currency {
  try {
    return localStorage.getItem(CURRENCY_KEY) === "XOF" ? "XOF" : "NGN";
  } catch {
    return "NGN";
  }
}

export function storeCurrency(currency: Currency) {
  try {
    localStorage.setItem(CURRENCY_KEY, currency);
  } catch {}
}
