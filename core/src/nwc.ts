import { z } from "zod";

/** Format check for a nostr+walletconnect:// connection string (NIP-47). */
export const NwcUrl = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const url = new URL(value.replace(/^nostr\+walletconnect:/i, "http:"));
      return (
        /^nostr\+walletconnect:\/\//i.test(value) &&
        /^[0-9a-f]{64}$/i.test(url.hostname) &&
        url.searchParams.getAll("relay").length > 0 &&
        /^[0-9a-f]{64}$/i.test(url.searchParams.get("secret") ?? "")
      );
    } catch {
      return false;
    }
  });
