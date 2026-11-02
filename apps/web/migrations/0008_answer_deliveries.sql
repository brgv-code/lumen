-- LUM-2: each kept answer reaches each destination once, like deliveries does for highlights.
CREATE TABLE answer_deliveries (
  answer_id TEXT NOT NULL REFERENCES highlight_answers(id) ON DELETE CASCADE,
  destination_id TEXT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'delivered',  -- delivered | failed
  attempts INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  delivered_at INTEGER NOT NULL,
  PRIMARY KEY (answer_id, destination_id)
);

-- Answers kept before their highlight was delivered rode along with it (LUM-1), so they already
-- reached that destination. Answers kept afterwards never did and stay pending.
INSERT INTO answer_deliveries (answer_id, destination_id, status, attempts, error, delivered_at)
SELECT a.id, d.destination_id, 'delivered', 1, NULL, d.delivered_at
FROM highlight_answers a JOIN deliveries d ON d.highlight_id = a.highlight_id
WHERE d.status = 'delivered' AND a.created_at <= d.delivered_at;
