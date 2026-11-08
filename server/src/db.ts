import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Server-side storage is only for public data (e.g. cached exchange rates).
// Never store message text, invoices, NWC strings or keys here.
// See docs/THREAT_MODEL.md.

export function openDb(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  return db;
}
