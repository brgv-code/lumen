-- Trial abuse guards and a site wide AI budget.
ALTER TABLE users ADD COLUMN email_canonical TEXT;
ALTER TABLE users ADD COLUMN signup_ip_hash TEXT;
ALTER TABLE users ADD COLUMN trial_note TEXT;
CREATE INDEX users_signup_ip ON users(signup_ip_hash, created_at);

-- One row per thing that already received a trial. No foreign key: a deleted account keeps its
-- claim, so delete and sign up again does not reset the trial.
CREATE TABLE trial_claims (
  kind TEXT NOT NULL,          -- email | device | ip
  value TEXT NOT NULL,         -- canonical email hash, device id hash, ip hash
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX trial_claims_lookup ON trial_claims(kind, value, created_at);

-- Hosted AI answers across everyone, per UTC day.
CREATE TABLE ai_global (
  day TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
