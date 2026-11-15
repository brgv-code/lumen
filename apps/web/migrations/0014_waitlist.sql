-- People waiting for an account while signups are paused; approved_at lets one in.
CREATE TABLE waitlist (
  email_canonical TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  source TEXT NOT NULL,
  ip_hash TEXT,
  approved_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX waitlist_ip ON waitlist(ip_hash, created_at);
