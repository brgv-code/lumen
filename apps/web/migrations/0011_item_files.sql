-- The stored file behind an item (PDFs today). Text is pending until a browser parses the file once.
CREATE TABLE item_files (
  item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  r2_key TEXT,               -- null until the bytes are stored
  sha256 TEXT,
  bytes INTEGER,
  pages INTEGER,
  text_status TEXT NOT NULL DEFAULT 'pending',  -- pending | ready | no_text | failed
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX item_files_user_sha ON item_files(user_id, sha256);
