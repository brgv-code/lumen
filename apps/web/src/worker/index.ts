import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { AppEnv, Env } from "./env";
import { auth } from "./routes/auth";
import { items } from "./routes/items";
import { highlights } from "./routes/highlights";
import { collections } from "./routes/collections";
import { destinations } from "./routes/destinations";
import { ai, ideas } from "./routes/ai";
import { me } from "./routes/me";
import { requireUser } from "./lib/session";
import { purgeDemos } from "./lib/seed";

const app = new Hono<AppEnv>();

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: { code: "internal", message: "Something went wrong on our side." } }, 500);
});

app.get("/api/health", (c) => c.json({ ok: true, service: "lumen", time: new Date().toISOString() }));

app.route("/auth", auth);

// The extension calls the API with a Bearer token from its own origin.
app.use("/api/v1/*", cors({
  origin: (o) => (o && (o.startsWith("chrome-extension://") || o.startsWith("moz-extension://")) ? o : null),
  allowHeaders: ["authorization", "content-type"],
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  maxAge: 86400,
}));
app.use("/api/v1/*", requireUser);
app.route("/api/v1", me);
app.route("/api/v1/items", items);
app.route("/api/v1/highlights", highlights);
app.route("/api/v1/collections", collections);
app.route("/api/v1/destinations", destinations);
app.route("/api/v1/ai", ai);
app.route("/api/v1/ideas", ideas);

app.all("/api/*", (c) => c.json({ error: { code: "not_found", message: "No such endpoint." } }, 404));

// Everything else is the single page app.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  async scheduled(_e: ScheduledController, env: Env) {
    await purgeDemos(env.DB);
  },
} satisfies ExportedHandler<Env>;
