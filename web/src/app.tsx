import type { Currency, Invoice } from "@sye/core";
import { loadPending, storePending } from "./lib/pending.ts";
import { useCallback, useEffect, useState } from "preact/hooks";
import { loadCurrency, storeCurrency, useRates } from "./lib/rates.ts";
import { forgetWallet, loadWallet, saveWallet } from "./lib/vault.ts";
import { balanceSats, openWallet, type Wallet, withTimeout } from "./lib/wallet.ts";
import { Connect } from "./screens/Connect.tsx";
import { Home } from "./screens/Home.tsx";
import { Receive } from "./screens/Receive.tsx";
import { Send } from "./screens/Send.tsx";
import { strings } from "./strings.ts";

type Screen = "home" | "send" | "receive";

export function App() {
  const [wallet, setWallet] = useState<Wallet | null | undefined>(undefined);
  const [screen, setScreen] = useState<Screen>("home");
  const [balance, setBalance] = useState<number | undefined>();
  const [balanceError, setBalanceError] = useState(false);
  const [currency, setCurrency] = useState<Currency>(loadCurrency);
  const [pending, setPending] = useState<Invoice | undefined>(loadPending);
  const updatePending = (invoice: Invoice | undefined) => {
    setPending(invoice);
    storePending(invoice);
  };
  const rates = useRates();
  // Ticks so the rate's age stays accurate while a screen is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const rate = rates?.rates[currency];

  useEffect(() => {
    loadWallet()
      .then((saved) => setWallet(saved ? openWallet(saved.url, saved.isTest) : null))
      .catch(() => setWallet(null));
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!wallet) return;
    setBalanceError(false);
    try {
      setBalance(await balanceSats(wallet));
    } catch {
      setBalanceError(true);
    }
  }, [wallet]);

  useEffect(() => {
    if (wallet && screen === "home") refreshBalance();
  }, [wallet, screen]);

  const connect = async (url: string, isTest: boolean) => {
    const next = openWallet(url, isTest);
    try {
      await withTimeout(next.client.getInfo(), 30_000);
    } catch (err) {
      next.client.close();
      throw err;
    }
    await saveWallet({ url, isTest });
    setBalance(undefined);
    setScreen("home");
    setWallet(next);
  };

  const disconnect = async () => {
    wallet?.client.close();
    await forgetWallet();
    updatePending(undefined);
    setBalance(undefined);
    setWallet(null);
  };

  if (wallet === undefined) {
    return (
      <main class="screen">
        <p class="muted">{strings.loading}</p>
      </main>
    );
  }
  if (wallet === null) return <Connect onConnect={connect} />;

  const back = () => setScreen("home");
  const rateAgeMs = rates ? Math.max(0, now - rates.fetchedAt) : undefined;

  if (screen === "receive")
    return (
      <Receive
        wallet={wallet}
        currency={currency}
        rate={rate}
        rateAgeMs={rateAgeMs}
        onBack={back}
        onPaid={refreshBalance}
      />
    );
  if (screen === "send")
    return (
      <Send
        wallet={wallet}
        balance={balance}
        currency={currency}
        rate={rate}
        rateAgeMs={rateAgeMs}
        pending={pending}
        onPending={updatePending}
        onBack={back}
        onSent={refreshBalance}
      />
    );

  return (
    <Home
      balance={balance}
      balanceError={balanceError}
      isTest={wallet.isTest}
      currency={currency}
      rate={rate}
      rateAgeMs={rateAgeMs}
      onCurrency={(c) => {
        setCurrency(c);
        storeCurrency(c);
      }}
      onRefresh={refreshBalance}
      onSend={() => setScreen("send")}
      onReceive={() => setScreen("receive")}
      onDisconnect={disconnect}
      hasPending={pending !== undefined}
    />
  );
}
