// Warnings are what the guard shows on the pause screen.
//
// THE RULE THAT DOESN'T BEND: AI can only add warnings. Rule warnings are
// computed on the device first; anything later (AI, guardian) can only be
// appended with `addWarnings`, never remove or downgrade one. Warnings are frozen.

export type Severity = "low" | "med" | "high";
export type WarningSource = "rule" | "ai";

export type Warning = Readonly<{
  id: string;
  source: WarningSource;
  severity: Severity;
  /** One plain-English sentence. Always rendered as text, never as HTML. */
  reason: string;
}>;

const RANK: Record<Severity, number> = { high: 3, med: 2, low: 1 };

export function makeWarning(w: Warning): Warning {
  return Object.freeze({ ...w });
}

/** Union only: returns every existing warning plus the new ones, most serious first. */
export function addWarnings(existing: readonly Warning[], added: readonly Warning[]): readonly Warning[] {
  const seen = new Set(existing.map((w) => `${w.source}:${w.id}`));
  const merged = [...existing, ...added.filter((w) => !seen.has(`${w.source}:${w.id}`)).map(makeWarning)];
  return Object.freeze(sortWarnings(merged));
}

export function sortWarnings(warnings: readonly Warning[]): Warning[] {
  return [...warnings].sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

/** Serious = anything high, or two or more medium. Serious warnings slow down "Pay anyway". */
export function isSerious(warnings: readonly Warning[]): boolean {
  return warnings.some((w) => w.severity === "high") || warnings.filter((w) => w.severity === "med").length >= 2;
}
