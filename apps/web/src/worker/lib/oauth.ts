import type { Env } from "../env";
import { randomToken } from "./util";

export type Provider = "google" | "github";

export interface Profile {
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
}

export function configured(env: Env): Record<Provider, boolean> {
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  };
}

async function challengeFor(verifier: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function authorizeUrl(env: Env, provider: Provider, redirectUri: string) {
  const state = randomToken(16);
  const verifier = randomToken(32);
  let url: URL;
  if (provider === "google") {
    url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: await challengeFor(verifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
  } else {
    url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: "read:user user:email",
      state,
      code_challenge: await challengeFor(verifier),
      code_challenge_method: "S256",
    }).toString();
  }
  return { url: url.toString(), state, verifier };
}

export async function exchange(env: Env, provider: Provider, code: string, verifier: string, redirectUri: string): Promise<Profile> {
  if (provider === "google") {
    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    }).then((r) => r.json<{ access_token?: string; error?: string }>());
    if (!tok.access_token) throw new Error(`google token: ${tok.error ?? "no token"}`);
    const p = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tok.access_token}` },
    }).then((r) => r.json<{ sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string }>());
    return {
      providerAccountId: p.sub,
      email: p.email ?? null,
      emailVerified: Boolean(p.email_verified),
      name: p.name || p.email?.split("@")[0] || "Reader",
      avatarUrl: p.picture ?? null,
    };
  }

  const tok = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  }).then((r) => r.json<{ access_token?: string; error?: string }>());
  if (!tok.access_token) throw new Error(`github token: ${tok.error ?? "no token"}`);
  const h = { authorization: `Bearer ${tok.access_token}`, "user-agent": "lumen", accept: "application/vnd.github+json" };
  const u = await fetch("https://api.github.com/user", { headers: h }).then((r) =>
    r.json<{ id: number; login: string; name?: string; avatar_url?: string }>(),
  );
  const emails = await fetch("https://api.github.com/user/emails", { headers: h })
    .then((r) => (r.ok ? r.json<{ email: string; primary: boolean; verified: boolean }[]>() : []))
    .catch(() => []);
  const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
  return {
    providerAccountId: String(u.id),
    email: primary?.email ?? null,
    emailVerified: Boolean(primary),
    name: u.name || u.login,
    avatarUrl: u.avatar_url ?? null,
  };
}
