// Billing. Stripe Checkout and the customer portal when STRIPE_* secrets are set;
// otherwise the paywall records early access interest so nobody hits a dead end.
import { Hono } from "hono";
import type { AppEnv, Env } from "../env";
import { body, fail, now } from "../lib/util";
import { toUser } from "../lib/map";

export const billing = new Hono<AppEnv>();

const configured = (env: Env) => Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID);

async function stripe(env: Env, path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const j = await res.json<Record<string, any>>();
  if (!res.ok) throw new Error(j.error?.message ?? `Stripe ${res.status}`);
  return j;
}

billing.get("/", (c) => c.json({ configured: configured(c.env), user: toUser(c.get("user")) }));

billing.post("/checkout", async (c) => {
  const u = c.get("user");
  if (u.is_demo === 1) fail(403, "demo", "Checkout is off in the demo sandbox.");
  if (!configured(c.env)) fail(501, "billing_not_configured", "Billing opens soon. Join early access and Pro stays on when it does.");
  const origin = new URL(c.req.url).origin;
  const s = await stripe(c.env, "checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": c.env.STRIPE_PRICE_ID!,
    "line_items[0][quantity]": "1",
    client_reference_id: u.id,
    ...(u.stripe_customer_id ? { customer: u.stripe_customer_id } : u.email ? { customer_email: u.email } : {}),
    success_url: `${origin}/app/upgrade?status=success`,
    cancel_url: `${origin}/app/upgrade?status=cancelled`,
    allow_promotion_codes: "true",
  });
  return c.json({ url: s.url });
});

billing.post("/portal", async (c) => {
  const u = c.get("user");
  if (!configured(c.env) || !u.stripe_customer_id) fail(422, "no_subscription", "No subscription to manage yet.");
  const s = await stripe(c.env, "billing_portal/sessions", { customer: u.stripe_customer_id!, return_url: `${new URL(c.req.url).origin}/app/settings` });
  return c.json({ url: s.url });
});

billing.post("/interest", async (c) => {
  await c.env.DB.prepare("UPDATE users SET pro_interest_at = COALESCE(pro_interest_at, ?) WHERE id = ?").bind(now(), c.get("user").id).run();
  return c.json({ ok: true });
});

/** Demo and test accounts only: see the paywall, then go back to the trial. */
billing.post("/preview", async (c) => {
  const u = c.get("user");
  if (u.is_demo !== 1 && u.is_demo !== 3) fail(403, "not_demo", "Only demo and test accounts can preview the trial ending.");
  const b = await body<{ action?: string }>(c);
  const ends = b.action === "end" ? now() - 1000 : now() + 7 * 864e5;
  await c.env.DB.prepare("UPDATE users SET trial_ends_at = ? WHERE id = ?").bind(ends, u.id).run();
  const row = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(u.id).first();
  return c.json({ user: toUser(row as never) });
});

/** Stripe webhook (no session): verify the signature, then flip the plan. */
export async function stripeWebhook(req: Request, env: Env) {
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response("not configured", { status: 501 });
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const parts = Object.fromEntries(sig.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return new Response("stale", { status: 400 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (!sig.split(",").some((p) => p === `v1=${hex}`)) return new Response("bad signature", { status: 400 });

  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, any> } };
  const o = event.data.object;
  if (event.type === "checkout.session.completed" && o.client_reference_id) {
    await env.DB.prepare("UPDATE users SET plan = 'pro', stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?").bind(o.customer ?? null, o.subscription ?? null, o.client_reference_id).run();
  } else if (event.type === "customer.subscription.deleted") {
    await env.DB.prepare("UPDATE users SET plan = 'free' WHERE stripe_customer_id = ?").bind(o.customer).run();
  } else if (event.type === "customer.subscription.updated") {
    const active = ["active", "trialing", "past_due"].includes(o.status);
    await env.DB.prepare("UPDATE users SET plan = ? WHERE stripe_customer_id = ?").bind(active ? "pro" : "free", o.customer).run();
  }
  return Response.json({ received: true });
}
