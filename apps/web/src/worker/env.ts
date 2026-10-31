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
  created_at: number;
}

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser; via: "cookie" | "token" } };
