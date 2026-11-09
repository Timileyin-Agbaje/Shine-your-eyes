import { NwcUrl } from "@sye/core";
import { useState } from "preact/hooks";
import { createTestWallet } from "../lib/faucet.ts";
import { strings } from "../strings.ts";

const s = strings.connect;

type Props = { onConnect: (url: string, isTest: boolean) => Promise<void> };

export function Connect({ onConnect }: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"test" | "own" | undefined>();
  const [error, setError] = useState<string | undefined>();

  const tryTest = async () => {
    setBusy("test");
    setError(undefined);
    try {
      const url = await createTestWallet();
      await onConnect(url, true);
    } catch (err) {
      setError(err instanceof Error && err.message.startsWith("faucet") ? s.faucetDown : s.unreachable);
      setBusy(undefined);
    }
  };

  const connectOwn = async (e: Event) => {
    e.preventDefault();
    const parsed = NwcUrl.safeParse(code);
    if (!parsed.success) return setError(s.badCode);
    setBusy("own");
    setError(undefined);
    try {
      await onConnect(parsed.data, false);
    } catch {
      setError(s.unreachable);
      setBusy(undefined);
    }
  };

  return (
    <main class="screen">
      <header class="hero">
        <img class="logo" src="/icon.svg" alt="" width={64} height={64} />
        <h1>Shine Your Eye</h1>
        <p class="lead">{strings.tagline}</p>
      </header>

      <section class="card">
        <h2>{s.title}</h2>
        <button type="button" class="btn btn--primary" onClick={tryTest} disabled={!!busy}>
          {busy === "test" ? s.creating : s.tryTest}
        </button>
        <p class="muted small">{s.tryTestNote}</p>

        <p class="divider">{s.or}</p>

        <form onSubmit={connectOwn}>
          <label for="nwc">{s.pasteLabel}</label>
          <textarea
            id="nwc"
            rows={3}
            value={code}
            placeholder={s.pastePlaceholder}
            autocomplete="off"
            spellcheck={false}
            onInput={(e) => setCode(e.currentTarget.value)}
          />
          <button type="submit" class="btn btn--secondary" disabled={!!busy || !code.trim()}>
            {busy === "own" ? s.connecting : s.connectButton}
          </button>
        </form>
        <p class="muted small">{s.tip}</p>
        <p class="muted small">{s.stored}</p>
      </section>

      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
