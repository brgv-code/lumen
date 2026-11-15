// Ask styles (ADR-005). Storing them is Pro; deleting never is, it is the reader's data.
import { Hono, type Context } from "hono";
import { BUILTIN_STYLES, STYLES_PER_READER, freeSlug, upgradeAskPrefs, validateStyle, type AskPrefs, type Style } from "@lumen/core";
import type { AppEnv } from "../env";
import { trackUser } from "../lib/analytics";
import { entitlement, requirePro } from "../lib/plan";
import { body, fail, id, now } from "../lib/util";

export const templates = new Hono<AppEnv>();

interface StyleRow { id: string; name: string; slug: string; body: string }

const BUILTIN_KEYS = BUILTIN_STYLES.map((style) => style.key);
const toStyle = (row: StyleRow, locked: boolean): Style => ({ key: row.id, name: row.name, slug: row.slug, body: row.body, builtin: false, ...(locked ? { locked } : {}) });

async function listOwnStyles(c: Context<AppEnv>): Promise<StyleRow[]> {
  const { results } = await c.env.DB.prepare("SELECT id, name, slug, body FROM ask_templates WHERE user_id = ? ORDER BY created_at, rowid").bind(c.get("user").id).all<StyleRow>();
  return results;
}

async function savePrefs(c: Context<AppEnv>, prefs: AskPrefs) {
  await c.env.DB.prepare("UPDATE users SET ask_prefs = ? WHERE id = ?").bind(JSON.stringify(prefs), c.get("user").id).run();
}

function checked(input: { name?: unknown; body?: unknown }) {
  const result = validateStyle(input);
  if (!result.ok) fail(422, "bad_style", result.error);
  return result;
}

templates.get("/", async (c) => {
  const user = c.get("user");
  const pro = entitlement(user).pro;
  const [rows, usage] = await Promise.all([
    listOwnStyles(c),
    c.env.DB.prepare("SELECT template_key AS key, count, last_used_at AS lastUsedAt FROM template_usage WHERE user_id = ?").bind(user.id).all<{ key: string; count: number; lastUsedAt: number | null }>(),
  ]);
  const prefs = upgradeAskPrefs(user.ask_prefs);
  return c.json({
    styles: rows.map((row) => toStyle(row, !pro)),
    // Without Pro the default reads as Standard; the stored choice comes back with Pro.
    prefs: pro ? prefs : { ...prefs, defaultStyle: null },
    usage: Object.fromEntries(usage.results.map(({ key, count, lastUsedAt }) => [key, { count, lastUsedAt }])),
    pro,
  });
});

templates.post("/", async (c) => {
  requirePro(c, "templates");
  const { name, body: instruction } = checked(await body(c));
  const rows = await listOwnStyles(c);
  if (rows.length >= STYLES_PER_READER) fail(409, "too_many_styles", `You can keep ${STYLES_PER_READER} styles. Delete one to add another.`);
  const row = { id: id("tpl_"), name, slug: freeSlug(name, rows.map((style) => style.slug)), body: instruction };
  const at = now();
  await c.env.DB.prepare("INSERT INTO ask_templates (id, user_id, name, slug, body, created_at, updated_at) VALUES (?,?,?,?,?,?,?)")
    .bind(row.id, c.get("user").id, row.name, row.slug, row.body, at, at).run();
  trackUser(c, "template_created", { styles: rows.length + 1 });
  return c.json(toStyle(row, false), 201);
});

templates.put("/prefs", async (c) => {
  requirePro(c, "templates");
  const asked = upgradeAskPrefs(await body(c));
  const ownKeys = (await listOwnStyles(c)).map((row) => row.id);
  const known = new Set([...BUILTIN_KEYS, ...ownKeys]);
  if (asked.defaultStyle !== null && !known.has(asked.defaultStyle)) fail(422, "unknown_style", "That style doesn't exist.");
  const prefs: AskPrefs = {
    version: 1,
    defaultStyle: asked.defaultStyle,
    order: [...new Set(asked.order.filter((key) => known.has(key)))],
    hidden: [...new Set(asked.hidden.filter((key) => BUILTIN_KEYS.includes(key)))],
  };
  const before = upgradeAskPrefs(c.get("user").ask_prefs);
  await savePrefs(c, prefs);
  if (before.defaultStyle !== prefs.defaultStyle) trackUser(c, "default_style_set", { template: templateLabel(prefs.defaultStyle) });
  return c.json({ prefs });
});

templates.patch("/:id", async (c) => {
  requirePro(c, "templates");
  const { name, body: instruction } = checked(await body(c));
  const rows = await listOwnStyles(c);
  const current = rows.find((row) => row.id === c.req.param("id"));
  if (!current) fail(404, "not_found", "That style doesn't exist.");
  const slug = name === current.name ? current.slug : freeSlug(name, rows.filter((row) => row.id !== current.id).map((row) => row.slug));
  await c.env.DB.prepare("UPDATE ask_templates SET name = ?, slug = ?, body = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind(name, slug, instruction, now(), current.id, c.get("user").id).run();
  return c.json(toStyle({ id: current.id, name, slug, body: instruction }, false));
});

templates.delete("/:id", async (c) => {
  const user = c.get("user");
  const styleId = c.req.param("id");
  const result = await c.env.DB.prepare("DELETE FROM ask_templates WHERE id = ? AND user_id = ?").bind(styleId, user.id).run();
  if (!result.meta.changes) fail(404, "not_found", "That style doesn't exist.");
  const prefs = upgradeAskPrefs(user.ask_prefs);
  await Promise.all([
    savePrefs(c, { ...prefs, defaultStyle: prefs.defaultStyle === styleId ? null : prefs.defaultStyle, order: prefs.order.filter((key) => key !== styleId) }),
    c.env.DB.prepare("DELETE FROM template_usage WHERE user_id = ? AND template_key = ?").bind(user.id, styleId).run(),
  ]);
  trackUser(c, "template_deleted");
  return c.json({ ok: true });
});

/** What analytics may know about a style: a built in's id, or only that it is the reader's own. */
export function templateLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return BUILTIN_KEYS.includes(key) ? key : "custom";
}
