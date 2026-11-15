// While signups are paused, new people wait here until the owner approves them.
import type { Env } from "../env";
import { canonicalEmail } from "./abuse";
import { now } from "./util";

const DAY = 864e5;
/** Form entries from one network per 24 hours. */
export const WAITLIST_PER_IP_PER_DAY = 10;

export const signupsOpen = (env: Env) => env.SIGNUPS_OPEN !== "false";

export async function joinWaitlist(db: D1Database, entry: { email: string; name: string | null; source: "form" | "google" | "github"; ip: string }) {
  await db.prepare("INSERT OR IGNORE INTO waitlist (email_canonical, email, name, source, ip_hash, created_at) VALUES (?,?,?,?,?,?)")
    .bind(canonicalEmail(entry.email), entry.email, entry.name, entry.source, entry.ip, now()).run();
}

export async function isApproved(db: D1Database, email: string) {
  const row = await db.prepare("SELECT approved_at FROM waitlist WHERE email_canonical = ?").bind(canonicalEmail(email)).first<{ approved_at: number | null }>();
  return Boolean(row?.approved_at);
}

export async function waitlistFromIp(db: D1Database, ip: string) {
  const row = await db.prepare("SELECT count(*) AS n FROM waitlist WHERE ip_hash = ? AND created_at > ?").bind(ip, now() - DAY).first<{ n: number }>();
  return row?.n ?? 0;
}
