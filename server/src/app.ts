import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { serveStatic } from "@hono/node-server/serve-static";
import { APP_NAME } from "@sye/core";
import { Hono } from "hono";
import { createRates } from "./rates.ts";

export function createApp(opts: { db: DatabaseSync; webDist: string }) {
  const app = new Hono();

  app.get("/api/health", (c) => {
    const row = opts.db.prepare("SELECT 1 AS ok").get() as { ok: number } | undefined;
    return c.json({ ok: row?.ok === 1, app: APP_NAME });
  });

  const rates = createRates(opts.db);
  app.get("/api/rates", async (c) => {
    const current = await rates.get();
    if (!current) return c.json({ error: "Rates are unavailable right now." }, 503);
    c.header("Cache-Control", "public, max-age=60");
    return c.json(current);
  });

  app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

  // In production the server also serves the built PWA from web/dist.
  if (existsSync(opts.webDist)) {
    app.use("*", serveStatic({ root: opts.webDist }));
    const indexHtml = join(opts.webDist, "index.html");
    app.get("*", async (c) => c.html(await readFile(indexHtml, "utf8")));
  }

  return app;
}
