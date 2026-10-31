// Server side product events to PostHog (EU). Pseudonymous: the account id, never the email,
// page text, highlights or notes. Off unless POSTHOG_KEY is set.
import type { Env, SessionUser } from "../env";

type Props = Record<string, string | number | boolean | null | undefined | Record<string, unknown>>;

export function analyticsKey(env: Env): string | null {
  return env.POSTHOG_KEY?.startsWith("phc_") ? env.POSTHOG_KEY : null;
}
export const analyticsHost = (env: Env) => env.POSTHOG_HOST || "https://eu.i.posthog.com";

/** Who an event belongs to, and how they are tagged. The persistent test account is skipped. */
export function personProps(u: Pick<SessionUser, "is_demo" | "plan">) {
  return { is_demo: u.is_demo === 1, plan: u.plan };
}

export function track(env: Env, ctx: { waitUntil(p: Promise<unknown>): void } | undefined, distinctId: string, event: string, props: Props = {}) {
  const key = analyticsKey(env);
  if (!key || !distinctId) return;
  const send = fetch(`${analyticsHost(env)}/i/v0/e/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: key, event, distinct_id: distinctId, timestamp: new Date().toISOString(), properties: { $lib: "lumen-worker", ...props } }),
  }).then(() => undefined).catch((e) => console.error("posthog", e));
  if (ctx) ctx.waitUntil(send);
}

/** Successful API writes worth counting, by method and path. */
const ROUTES: [string, RegExp, string][] = [
  ["POST", /^\/api\/v1\/items\/?$/, "item_saved"],
  ["POST", /^\/api\/v1\/items\/[^/]+\/highlights$/, "highlight_created"],
  ["PATCH", /^\/api\/v1\/highlights\/[^/]+$/, "highlight_edited"],
  ["DELETE", /^\/api\/v1\/highlights\/[^/]+$/, "highlight_deleted"],
  ["DELETE", /^\/api\/v1\/items\/[^/]+$/, "item_deleted"],
  ["POST", /^\/api\/v1\/collections\/?$/, "collection_created"],
  ["POST", /^\/api\/v1\/destinations\/?$/, "destination_added"],
  ["POST", /^\/api\/v1\/destinations\/[^/]+\/push$/, "destination_pushed"],
  ["POST", /^\/api\/v1\/following\/?$/, "blog_followed"],
  ["POST", /^\/api\/v1\/shares\/?$/, "share_created"],
  ["POST", /^\/api\/v1\/tokens$/, "token_created"],
  ["POST", /^\/api\/v1\/topics$/, "radar_topic_added"],
  ["POST", /^\/api\/v1\/trends\/[^/]+\/save$/, "radar_item_saved"],
  ["POST", /^\/api\/v1\/billing\/checkout$/, "checkout_started"],
  ["POST", /^\/api\/v1\/billing\/interest$/, "pro_interest"],
  ["DELETE", /^\/api\/v1\/me$/, "account_deleted"],
];

export function eventFor(method: string, path: string): string | null {
  for (const [m, re, name] of ROUTES) if (m === method && re.test(path)) return name;
  return null;
}
