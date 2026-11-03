-- Recall: questions a reader answers in their own words after reading, reviewed on a widening schedule.
CREATE TABLE recall_cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  highlight_id TEXT REFERENCES highlights(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT,               -- the reader's latest answer, in their words
  step INTEGER NOT NULL DEFAULT 0,  -- remembered answers in a row
  reviews INTEGER NOT NULL DEFAULT 0,
  due_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  model TEXT,                -- null when the questions came from the no-model fallback
  created_at INTEGER NOT NULL
);
CREATE INDEX recall_due ON recall_cards(user_id, due_at);
CREATE INDEX recall_item ON recall_cards(item_id);
