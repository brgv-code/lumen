-- Agent usage, and public share cards.
ALTER TABLE api_tokens ADD COLUMN calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE api_tokens ADD COLUMN last_tool TEXT;

CREATE TABLE shares (
  id TEXT PRIMARY KEY,            -- short public slug
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,             -- highlight | progress | collection
  ref_id TEXT,
  title TEXT NOT NULL,
  payload TEXT NOT NULL,          -- a snapshot of exactly what is shared, nothing more
  image BLOB,                     -- 1200x630 JPEG for link previews
  views INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX shares_user ON shares(user_id, created_at DESC);
