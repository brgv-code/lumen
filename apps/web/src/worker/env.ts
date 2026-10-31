export interface Env {
  DB: D1Database;
  AI: Ai;
  ASSETS: Fetcher;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  /** Turn the "Try the demo" sandbox on (default on). */
  DEMO_ENABLED?: string;
  AI_MODEL?: string;
}

export interface SessionUser {
  id: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
  is_demo: number;
  plan: string;
  daily_goal: number;
  timezone: string;
  ai_provider: string;
  share_signals: number;
  reminders: number;
  created_at: number;
}

export type SelfFetch = (path: string, init?: RequestInit) => Promise<Response>;

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser; via: "cookie" | "token"; selfFetch: SelfFetch } };
