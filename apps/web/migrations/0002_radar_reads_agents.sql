-- v2.1: radar (trending topics), reminders, readers like you, agent connections, demo rate limit.

-- Reminders: snooze a nudge for an item in progress.
ALTER TABLE items ADD COLUMN remind_after INTEGER;
ALTER TABLE items ADD COLUMN last_opened_at INTEGER;

-- Privacy: anonymous reading signals for "readers like you" (aggregate only, k >= 2).
ALTER TABLE users ADD COLUMN share_signals INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN reminders INTEGER NOT NULL DEFAULT 1;

-- Tokens can be labelled as agent connections (MCP) and record the client name.
ALTER TABLE api_tokens ADD COLUMN kind TEXT NOT NULL DEFAULT 'extension';
ALTER TABLE api_tokens ADD COLUMN client TEXT;

-- Topics the radar watches, derived from tags and highlights, or added by hand.
CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto',   -- auto | manual
  muted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, name)
);

-- Trending stories found for a user's topics (Hacker News, dev.to).
CREATE TABLE trends (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  published_at INTEGER,
  dismissed INTEGER NOT NULL DEFAULT 0,
  fetched_at INTEGER NOT NULL,
  UNIQUE (user_id, url)
);
CREATE INDEX trends_user ON trends(user_id, dismissed, score DESC);

CREATE TABLE radar_runs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ran_at INTEGER NOT NULL
);

-- Abuse guard for the public demo endpoint.
CREATE TABLE demo_creations (
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX demo_creations_ip ON demo_creations(ip_hash, created_at);

CREATE INDEX items_url ON items(url);
