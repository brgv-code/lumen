import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export const now = () => Date.now();

const ALPHABET = "0123456789abcdefghijkmnopqrstuvwxyz";
export function id(prefix = ""): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return prefix + s;
}

export function randomToken(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function dayIn(tz: string, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

export function fail(status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 501 | 502, code: string, message: string): never {
  throw new HTTPException(status, { res: Response.json({ error: { code, message } }, { status }) });
}

export async function body<T = Record<string, unknown>>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    fail(400, "bad_json", "Request body must be JSON.");
  }
}

export function str(v: unknown, max = 2000): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

export function oneOf<T extends string>(v: unknown, list: readonly T[]): T | undefined {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function isHttpUrl(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

/** Cursor = base64 of "createdAt:id" for stable keyset pagination. */
export function encodeCursor(createdAt: number, rowId: string) {
  return btoa(`${createdAt}:${rowId}`);
}
export function decodeCursor(c?: string | null): { createdAt: number; id: string } | null {
  if (!c) return null;
  try {
    const [a, b] = atob(c).split(":");
    return { createdAt: Number(a), id: b };
  } catch {
    return null;
  }
}
