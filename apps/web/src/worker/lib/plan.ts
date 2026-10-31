// Freemium rules in one place.
//   Free forever: library, reader, highlights and notes, collections, the extension, Obsidian and
//   markdown destinations, daily reads, reminders, readers like you, export, your own models.
//   Pro (7 day trial for everyone): Spark, Radar, agents over MCP, analytics, Notion and webhook
//   destinations, and more hosted AI answers.
import type { Context } from "hono";
import type { AppEnv, SessionUser } from "../env";
import { fail, now } from "./util";

export const TRIAL_DAYS = 7;
export type ProFeature = "spark" | "radar" | "agents" | "analytics" | "notion" | "webhook";

export const FEATURE_LABEL: Record<ProFeature, string> = {
  spark: "Spark writing ideas",
  radar: "Radar",
  agents: "Agent access (MCP)",
  analytics: "Analytics",
  notion: "Notion sync",
  webhook: "Webhooks",
};

export function trialEndsAt(u: Pick<SessionUser, "created_at"> & { trial_ends_at?: number | null }) {
  return u.trial_ends_at ?? u.created_at + TRIAL_DAYS * 864e5;
}

export function entitlement(u: SessionUser & { trial_ends_at?: number | null }) {
  const ends = trialEndsAt(u);
  const paid = u.plan === "pro";
  const trialing = !paid && now() < ends;
  return {
    pro: paid || trialing,
    status: paid ? ("pro" as const) : trialing ? ("trial" as const) : ("free" as const),
    trialEndsAt: ends,
    trialDaysLeft: trialing ? Math.max(1, Math.ceil((ends - now()) / 864e5)) : 0,
  };
}

export function aiDailyCap(u: SessionUser & { trial_ends_at?: number | null }) {
  if (u.is_demo === 1) return 40;
  return entitlement(u).pro ? 500 : 15;
}

/** Throws 402 with a code the client turns into the paywall. */
export function requirePro(c: Context<AppEnv>, feature: ProFeature) {
  const u = c.get("user") as SessionUser & { trial_ends_at?: number | null };
  if (!entitlement(u).pro) fail(402, "upgrade_required", `${FEATURE_LABEL[feature]} is part of Lumen Pro. Your 7 day trial has ended.`);
}
