-- Following: favourite blogs and their new posts.
CREATE TABLE feeds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_url TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  title TEXT NOT NULL,
  notify INTEGER NOT NULL DEFAULT 1,
  last_checked_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, feed_url)
);
CREATE INDEX feeds_due ON feeds(last_checked_at);

CREATE TABLE feed_items (
  id TEXT PRIMARY KEY,
  feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  published_at INTEGER,
  seen INTEGER NOT NULL DEFAULT 0,
  notified INTEGER NOT NULL DEFAULT 0,
  found_at INTEGER NOT NULL,
  UNIQUE (user_id, url)
);
CREATE INDEX feed_items_user ON feed_items(user_id, seen, published_at DESC);
