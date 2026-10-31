// Abuse guards: one trial per person, a cap on new accounts per network, and nothing that stops a
// real reader from using the free plan. Identifiers are stored hashed.
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../env";
import { now, randomToken, sha256 } from "./util";

export const DEVICE_COOKIE = "lumen_did";
const DAY = 864e5;
/** New accounts from one network per 24 hours before sign up pauses there. */
export const SIGNUPS_PER_IP_PER_DAY = 5;
/** Trials from one network per 30 days (offices and campuses share addresses). */
const TRIALS_PER_IP = 2;
/** GitHub accounts younger than this start on the free plan. */
const MIN_GITHUB_AGE_DAYS = 30;

const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.info", "sharklasers.com", "grr.la", "10minutemail.com",
  "temp-mail.org", "tempmail.com", "tempmailo.com", "yopmail.com", "trashmail.com", "getnada.com", "dispostable.com",
  "maildrop.cc", "mailnesia.com", "throwawaymail.com", "fakeinbox.com", "emailondeck.com", "mintemail.com",
  "spamgourmet.com", "mohmal.com", "tmail.ws", "burnermail.io", "moakt.com", "mail.tm", "1secmail.com",
]);

/** Same inbox, same person: lower case, no +tags, and no dots for Gmail. */
export function canonicalEmail(email: string): string {
  const [local0, domain0] = email.trim().toLowerCase().split("@");
  if (!domain0) return email.trim().toLowerCase();
  let local = local0.split("+")[0];
  let domain = domain0;
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

export const isDisposable = (email: string) => DISPOSABLE.has(email.split("@")[1]?.toLowerCase() ?? "");

/** IPv4 as is, IPv6 by its /64 (one household or phone gets a whole /64). */
export function ipHash(c: Context<AppEnv>): Promise<string> {
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  const key = ip.includes(":") ? ip.split(":").slice(0, 4).join(":") : ip;
  return sha256("lumen-ip:" + key);
}

/** A first party, http only device id, used only for trial abuse checks. */
export function ensureDevice(c: Context<AppEnv>): string {
  let d = getCookie(c, DEVICE_COOKIE);
  if (!d || !/^[A-Za-z0-9_-]{16,64}$/.test(d)) {
    d = randomToken(16);
    setCookie(c, DEVICE_COOKIE, d, { httpOnly: true, secure: new URL(c.req.url).protocol === "https:", sameSite: "Lax", path: "/", maxAge: 400 * 86400 });
  }
  return d;
}

export async function signupsFromIp(db: D1Database, ip: string) {
  const r = await db.prepare("SELECT count(*) AS n FROM users WHERE signup_ip_hash = ? AND created_at > ?").bind(ip, now() - DAY).first<{ n: number }>();
  return r?.n ?? 0;
}

export interface TrialInput { email: string | null; emailVerified: boolean; deviceId: string | null; ip: string; githubCreatedAt?: number | null }

/** Decide whether a brand new account gets the 7 day trial. Returns the reason when it does not. */
export async function trialDecision(db: D1Database, x: TrialInput): Promise<{ trial: boolean; note: string }> {
  if (!x.email || !x.emailVerified) return { trial: false, note: "no_verified_email" };
  if (isDisposable(x.email)) return { trial: false, note: "disposable_email" };
  if (x.githubCreatedAt && now() - x.githubCreatedAt < MIN_GITHUB_AGE_DAYS * DAY) return { trial: false, note: "new_github_account" };
  const emailKey = await sha256("lumen-email:" + canonicalEmail(x.email));
  const used = await db.prepare("SELECT 1 FROM trial_claims WHERE kind = 'email' AND value = ? LIMIT 1").bind(emailKey).first();
  if (used) return { trial: false, note: "email_had_trial" };
  if (x.deviceId) {
    const d = await db.prepare("SELECT 1 FROM trial_claims WHERE kind = 'device' AND value = ? AND created_at > ? LIMIT 1").bind(await sha256("lumen-device:" + x.deviceId), now() - 90 * DAY).first();
    if (d) return { trial: false, note: "device_had_trial" };
  }
  const n = await db.prepare("SELECT count(*) AS n FROM trial_claims WHERE kind = 'ip' AND value = ? AND created_at > ?").bind(x.ip, now() - 30 * DAY).first<{ n: number }>();
  if ((n?.n ?? 0) >= TRIALS_PER_IP) return { trial: false, note: "network_had_trials" };
  return { trial: true, note: "ok" };
}

export async function claimTrial(db: D1Database, userId: string, x: TrialInput) {
  const t = now();
  const rows: [string, string][] = [["ip", x.ip]];
  if (x.email) rows.push(["email", await sha256("lumen-email:" + canonicalEmail(x.email))]);
  if (x.deviceId) rows.push(["device", await sha256("lumen-device:" + x.deviceId)]);
  await db.batch(rows.map(([k, v]) => db.prepare("INSERT INTO trial_claims (kind, value, user_id, created_at) VALUES (?,?,?,?)").bind(k, v, userId, t)));
}
