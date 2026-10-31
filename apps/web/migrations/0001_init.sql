-- Lumen schema v1. Every row is scoped by user_id; ids are random text.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT NOT NULL,
  avatar_url TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  plan TEXT NOT NULL DEFAULT 'free',
  daily_goal INTEGER NOT NULL DEFAULT 20,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  ai_provider TEXT NOT NULL DEFAULT 'lumen',
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX users_email ON users(email) WHERE email IS NOT NULL;

-- One row per SSO identity (Google, GitHub). A user can link several.
CREATE TABLE accounts (
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_account_id)
);

-- Browser sessions. id is sha256(token); the raw token only lives in the cookie.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Personal access tokens for the extension and scripts.
CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE destinations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,           -- obsidian | notion | markdown | webhook
  name TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',  -- public config json
  secret TEXT,                  -- server side secret (notion token, webhook secret)
  created_at INTEGER NOT NULL
);

CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📚',
  color TEXT NOT NULL DEFAULT 'sun',
  description TEXT,
  destination_id TEXT REFERENCES destinations(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX collections_user ON collections(user_id);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  site_name TEXT,
  author TEXT,
  excerpt TEXT,
  content_html TEXT,
  content_text TEXT,
  cover_url TEXT,
  kind TEXT NOT NULL DEFAULT 'article',
  status TEXT NOT NULL DEFAULT 'inbox',
  progress REAL NOT NULL DEFAULT 0,
  favorite INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  reading_minutes INTEGER NOT NULL DEFAULT 1,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  finished_at INTEGER,
  UNIQUE (user_id, url)
);
CREATE INDEX items_user_status ON items(user_id, status, created_at DESC);
CREATE INDEX items_user_collection ON items(user_id, collection_id);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (user_id, name)
);
CREATE TABLE item_tags (
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE highlights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quote TEXT NOT NULL,
  prefix TEXT NOT NULL DEFAULT '',
  suffix TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT 'sun',
  note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX highlights_item ON highlights(item_id, position);
CREATE INDEX highlights_user ON highlights(user_id, created_at DESC);

-- The ledger that makes "append only new highlights" true:
-- a highlight is sent to a destination at most once.
CREATE TABLE deliveries (
  highlight_id TEXT NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
  destination_id TEXT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'delivered',  -- delivered | failed
  attempts INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  delivered_at INTEGER NOT NULL,
  PRIMARY KEY (highlight_id, destination_id)
);

-- Glow ledger: one row per rewarded action. Streaks and charts read from here.
CREATE TABLE activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  item_id TEXT,
  glow INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX activity_user_day ON activity(user_id, day);

CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  angle TEXT NOT NULL,
  outline TEXT NOT NULL DEFAULT '[]',
  source_item_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);
CREATE INDEX ideas_user ON ideas(user_id, created_at DESC);

CREATE TABLE ai_usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
