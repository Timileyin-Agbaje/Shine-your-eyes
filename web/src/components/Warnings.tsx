import type { Warning } from "@sye/core";
import { strings } from "../strings.ts";

const ICON: Record<Warning["severity"], string> = { high: "⛔", med: "⚠️", low: "ℹ️" };

/** Warnings, most serious first, each as one plain sentence (rendered as text, never HTML). */
export function Warnings({ warnings }: { warnings: readonly Warning[] }) {
  if (warnings.length === 0) {
    return (
      <p class="no-warnings" data-testid="no-warnings">
        {strings.guard.noWarnings}
      </p>
    );
  }
  return (
    <ul class="warnings" aria-label={strings.guard.warningsLabel}>
      {warnings.map((w) => (
        <li key={`${w.source}:${w.id}`} class={`warning warning--${w.severity}`} data-warning-id={w.id}>
          <span aria-hidden="true">{ICON[w.severity]}</span>
          <span>{w.reason}</span>
        </li>
      ))}
    </ul>
  );
}
