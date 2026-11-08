import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { serveStatic } from "@hono/node-server/serve-static";
import { APP_NAME } from "@sye/core";
import { Hono } from "hono";

export function createApp(opts: { db: DatabaseSync; webDist: string }) {
  const app = new Hono();

  app.get("/api/health", (c) => {
    const row = opts.db.prepare("SELECT 1 AS ok").get() as { ok: number } | undefined;
    return c.json({ ok: row?.ok === 1, app: APP_NAME });
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
