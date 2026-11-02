// Product analytics with PostHog (EU), only after the visitor says yes. Nothing loads before that:
// the library is imported on consent. Reading content inside the app is masked in replays.
import type { PostHog } from "posthog-js";
import type { User } from "@lumen/core";

const KEY = "lumen.analytics";
type Cfg = { key: string; host: string } | null;
let cfg: Cfg | undefined;
let ph: PostHog | null = null;
let who: User | null = null;
const listeners = new Set<() => void>();

export type Consent = "yes" | "no" | null;
export function consent(): Consent {
  try { const v = localStorage.getItem(KEY); return v === "yes" || v === "no" ? v : null; } catch { return "no"; }
}

async function config(): Promise<Cfg> {
  if (cfg !== undefined) return cfg;
  try {
    const r = await fetch("/auth/providers", { credentials: "same-origin" }).then((x) => x.json() as Promise<{ analytics?: Cfg }>);
    cfg = r.analytics ?? null;
  } catch { cfg = null; }
  return cfg;
}

/** Whether to ask: analytics configured and the visitor has not chosen yet. */
export async function shouldAsk() { return consent() === null && Boolean(await config()); }
export const analyticsConfigured = async () => Boolean(await config());

export function onConsentChange(f: () => void) { listeners.add(f); return () => listeners.delete(f); }

export async function setConsent(v: "yes" | "no") {
  try { localStorage.setItem(KEY, v); } catch { /* private mode */ }
  if (v === "yes") await start();
  else if (ph) { ph.opt_out_capturing(); ph.stopSessionRecording(); }
  listeners.forEach((f) => f());
}

async function start() {
  if (consent() !== "yes") return;
  const c = await config();
  if (!c) return;
  if (ph) { ph.opt_in_capturing(); ph.startSessionRecording(); apply(); return; }
  const { default: posthog } = await import("posthog-js");
  posthog.init(c.key, {
    api_host: c.host,
    ui_host: "https://eu.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: true,
    persistence: "localStorage+cookie",
    session_recording: { maskAllInputs: true, maskTextSelector: ".ph-mask" },
  });
  ph = posthog;
  apply();
}

function apply() {
  if (!ph || !who) return;
  if (ph.get_distinct_id() !== who.id) ph.identify(who.id);
  ph.setPersonProperties(who.isDemo
    ? { is_demo: true, plan: who.plan }
    : { email: who.email, name: who.name, plan: who.plan, plan_status: who.planStatus, is_demo: false, signed_up_at: new Date(who.createdAt).toISOString() });
}

/** Call once per page load; starts PostHog if the visitor already agreed. */
export function initAnalytics() { void start(); }
export function identify(u: User) { who = u; apply(); }
export function resetAnalytics() { who = null; ph?.reset(); }
export function capture(event: string, props?: Record<string, unknown>) { ph?.capture(event, props); }
