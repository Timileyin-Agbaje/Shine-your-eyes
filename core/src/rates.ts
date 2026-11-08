import { z } from "zod";

export const RatesResponse = z.object({
  rates: z.object({ NGN: z.number().positive(), XOF: z.number().positive() }),
  /** When the server last got fresh rates, in ms since epoch. */
  fetchedAt: z.number().int(),
  source: z.string(),
});
export type RatesResponse = z.infer<typeof RatesResponse>;
