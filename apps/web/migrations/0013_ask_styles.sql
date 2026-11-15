-- ADR-005: Ask styles. Built ins live in @lumen/core; these are the reader's own and what they chose.
CREATE TABLE ask_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,            -- the pill label
  slug TEXT NOT NULL,            -- typed as /slug
  body TEXT NOT NULL,            -- the instruction
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX ask_templates_slug ON ask_templates(user_id, slug);

-- How often each style shaped an answer, built in or the reader's own; shown back to the reader.
CREATE TABLE template_usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  PRIMARY KEY (user_id, template_key)
);

ALTER TABLE users ADD COLUMN ask_prefs TEXT; -- JSON, read through upgradeAskPrefs
