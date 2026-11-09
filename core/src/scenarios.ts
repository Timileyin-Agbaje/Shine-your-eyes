import { z } from "zod";
import { CURRENCIES } from "./money.ts";
import { RULE_IDS } from "./rules.ts";

/** The fixed set of signals the AI check may raise (TIM-88). There is no "safe". */
export const AI_SIGNALS = [
  "urgency",
  "impersonation",
  "secrecy",
  "guaranteed_returns",
  "fee_to_unlock",
  "unusual_payment_method",
  "mismatch",
] as const;
export type AiSignal = (typeof AI_SIGNALS)[number];

const Money = z.object({ amount: z.number().positive(), currency: z.enum(CURRENCIES) });

/**
 * A payment request plus the message that came with it, and the warnings the
 * guard should show. Drives the data-driven e2e test and `pnpm eval`.
 */
export const Scenario = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  category: z.enum(["scam", "injection", "legit"]),
  title: z.string(),
  message: z.string(),
  /** What the invoice really asks for, and how long until it expires. */
  invoice: Money.extend({ expiryMinutes: z.number().int().positive() }),
  context: z
    .object({
      /** Earlier payments: to this same payee, or to someone else. */
      history: z.array(Money.extend({ payee: z.enum(["this", "other"]) })).default([]),
      /** The phone's local hour when paying. */
      localHour: z.number().int().min(0).max(23).default(14),
    })
    .default({ history: [], localHour: 14 }),
  /** True when the message holds phone/account numbers or emails that redaction must remove. */
  containsPersonalData: z.boolean().default(false),
  expected: z.object({
    rules: z.array(z.enum(RULE_IDS)),
    ai: z.array(z.enum(AI_SIGNALS)),
  }),
});
export type Scenario = z.infer<typeof Scenario>;

export const Scenarios = z.array(Scenario).superRefine((list, ctx) => {
  const ids = new Set<string>();
  for (const s of list) {
    if (ids.has(s.id)) ctx.addIssue({ code: "custom", message: `duplicate scenario id ${s.id}` });
    ids.add(s.id);
  }
});
