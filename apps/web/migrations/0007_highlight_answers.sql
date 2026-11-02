-- LUM-1: margin answers the reader kept. The note goes back to holding only the reader's words.
CREATE TABLE highlight_answers (
  id TEXT PRIMARY KEY,
  highlight_id TEXT NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES highlight_answers(id) ON DELETE SET NULL, -- the answer this followed up on
  action TEXT NOT NULL,          -- explain | simplify | define | counterpoint | expand | summarize | ask
  question TEXT,                 -- what the reader typed, for ask
  answer TEXT NOT NULL,
  model TEXT,                    -- shown in the card footer
  created_at INTEGER NOT NULL
);
CREATE INDEX highlight_answers_highlight ON highlight_answers(highlight_id, created_at);

-- Before LUM-1, keeping an answer wrote "Explain: …" into the note. Move those answers once.
-- substr, not LIKE: LIKE ignores case and treats _ and % as wildcards.
INSERT INTO highlight_answers (id, highlight_id, parent_id, action, question, answer, model, created_at)
SELECT 'ans_' || lower(hex(randomblob(10))), id, NULL,
  CASE
    WHEN substr(note, 1, 9) = 'Explain: ' THEN 'explain'
    WHEN substr(note, 1, 8) = 'Define: ' THEN 'define'
    WHEN substr(note, 1, 8) = 'Expand: ' THEN 'expand'
    WHEN substr(note, 1, 11) = 'Summarize: ' THEN 'summarize'
    ELSE 'ask'
  END,
  NULL,
  CASE
    WHEN substr(note, 1, 9) = 'Explain: ' THEN substr(note, 10)
    WHEN substr(note, 1, 8) IN ('Define: ', 'Expand: ') THEN substr(note, 9)
    WHEN substr(note, 1, 11) = 'Summarize: ' THEN substr(note, 12)
    ELSE substr(note, 6)
  END,
  NULL, updated_at
FROM highlights
WHERE substr(note, 1, 9) = 'Explain: ' OR substr(note, 1, 8) IN ('Define: ', 'Expand: ')
  OR substr(note, 1, 11) = 'Summarize: ' OR substr(note, 1, 5) = 'Ask: ';

UPDATE highlights SET note = NULL
WHERE substr(note, 1, 9) = 'Explain: ' OR substr(note, 1, 8) IN ('Define: ', 'Expand: ')
  OR substr(note, 1, 11) = 'Summarize: ' OR substr(note, 1, 5) = 'Ask: ';
