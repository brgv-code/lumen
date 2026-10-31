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
import { discover } from "./routes/discover";
import { mcpApp } from "./routes/mcp";
import { seo, notFound } from "./seo/routes";
import { requireUser } from "./lib/session";
import { purgeDemos } from "./lib/seed";
import { refreshActiveRadars } from "./lib/radar";

const app = new Hono<AppEnv>();
let ctxRef: ExecutionContext | undefined;
let envRef: Env | undefined;
/** Call our own routes in process (used by MCP tools and a few compound endpoints). */
const internal = (req: Request) => Promise.resolve(app.fetch(req, envRef!, ctxRef));

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: { code: "internal", message: "Something went wrong on our side." } }, 500);
});

app.get("/api/health", (c) => c.json({ ok: true, service: "lumen", time: new Date().toISOString() }));

app.route("/auth", auth);
app.route("/mcp", mcpApp(internal));

// The extension calls the API with a Bearer token from its own origin.
app.use("/api/v1/*", cors({
  origin: (o) => (o && (o.startsWith("chrome-extension://") || o.startsWith("moz-extension://")) ? o : null),
  allowHeaders: ["authorization", "content-type"],
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  maxAge: 86400,
}));
app.use("/api/v1/*", requireUser);
app.use("/api/v1/*", async (c, next) => {
  const forward: Record<string, string> = { "content-type": "application/json", "x-lumen": "1" };
  const a = c.req.header("authorization");
  const ck = c.req.header("cookie");
  if (a) forward.authorization = a;
  else if (ck) forward.cookie = ck;
  c.set("selfFetch", (path, init) => internal(new Request(new URL(path, c.req.url), { ...init, headers: { ...forward, ...(init?.headers ?? {}) } })));
  await next();
});
app.route("/api/v1", me);
app.route("/api/v1", discover);
app.route("/api/v1/items", items);
app.route("/api/v1/highlights", highlights);
app.route("/api/v1/collections", collections);
app.route("/api/v1/destinations", destinations);
app.route("/api/v1/ai", ai);
app.route("/api/v1/ideas", ideas);

app.all("/api/*", (c) => c.json({ error: { code: "not_found", message: "No such endpoint." } }, 404));

// Crawlable pages (compare, answers, docs, legal, sitemap, robots, llms.txt).
app.route("/", seo);

// Everything else is the single page app; unknown deep links outside the app get a real 404.
app.all("*", async (c) => {
  const p = new URL(c.req.url).pathname;
  const isApp = p === "/" || p === "/login" || p.startsWith("/app") || p.startsWith("/assets/") || /\.[a-z0-9]+$/i.test(p);
  if (!isApp) return notFound();
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext) {
    envRef = env;
    ctxRef = ctx;
    return app.fetch(req, env, ctx);
  },
  async scheduled(_e: ScheduledController, env: Env) {
    await purgeDemos(env.DB);
    await refreshActiveRadars(env.DB);
  },
} satisfies ExportedHandler<Env>;
