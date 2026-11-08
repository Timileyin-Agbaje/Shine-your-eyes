import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { openDb } from "./db.ts";

const port = Number(process.env.PORT ?? 8787);
const dbPath = process.env.SYE_DB_PATH ?? fileURLToPath(new URL("../data/sye.db", import.meta.url));
const webDist = fileURLToPath(new URL("../../web/dist", import.meta.url));

const app = createApp({ db: openDb(dbPath), webDist });

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`server listening on http://localhost:${info.port}`);
});
