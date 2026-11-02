-- LUM-3: the TL;DR a reader kept for a page, one per item, and its own delivery ledger.
CREATE TABLE item_tldrs (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  model TEXT,
  citations TEXT NOT NULL DEFAULT '[]',  -- JSON [{ n, quote: TextQuote }]
  created_at INTEGER NOT NULL
);

CREATE TABLE tldr_deliveries (
  tldr_id TEXT NOT NULL REFERENCES item_tldrs(id) ON DELETE CASCADE,
  destination_id TEXT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'delivered',  -- delivered | failed
  attempts INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  delivered_at INTEGER NOT NULL,
  PRIMARY KEY (tldr_id, destination_id)
);
