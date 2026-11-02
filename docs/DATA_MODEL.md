# Data model (D1)

```mermaid
erDiagram
  users ||--o{ accounts : "signs in with"
  users ||--o{ sessions : has
  users ||--o{ api_tokens : has
  users ||--o{ items : saves
  users ||--o{ collections : owns
  users ||--o{ destinations : owns
  users ||--o{ highlights : makes
  users ||--o{ activity : earns
  users ||--o{ ideas : keeps
  users ||--o{ ai_usage : spends
  collections }o--o| destinations : "sends to"
  items }o--o| collections : "filed in"
  items ||--o{ highlights : contains
  items ||--o{ item_tags : tagged
  tags ||--o{ item_tags : labels
  highlights ||--o{ deliveries : "delivered as"
  highlights ||--o{ highlight_answers : keeps
  highlight_answers ||--o{ answer_deliveries : "delivered as"
  destinations ||--o{ answer_deliveries : receives
  destinations ||--o{ deliveries : receives
```

| Table | Purpose | Notable columns and constraints |
|---|---|---|
| `users` | one reader | `is_demo`, `plan`, `daily_goal`, `timezone`, `ai_provider`; unique email when present |
| `accounts` | SSO identities | PK `(provider, provider_account_id)` |
| `sessions` | browser sessions | `id = sha256(token)`, `expires_at` |
| `api_tokens` | extension and script access | `token_hash` unique, `prefix` for display, `last_used_at` |
| `collections` | shelves per project | `destination_id` (nullable) |
| `items` | saved pages | unique `(user_id, url)`, `status`, `progress`, `content_html`, `content_text`, `reading_minutes` |
| `tags`, `item_tags` | free tagging | unique `(user_id, name)` |
| `highlights` | text quote selectors | `quote`, `prefix`, `suffix`, `position`, `color` (palette name or `#rrggbb`, see `packages/core/src/colors.ts`), `note` |
| `highlight_answers` | margin answers the reader kept | `action`, `question` (for ask), `answer`, `model`, `parent_id` (the answer it followed up on, same highlight) |
| `answer_deliveries` | the ledger for kept answers | PK `(answer_id, destination_id)`, `status`, `attempts`, `error` |
| `deliveries` | the ledger | PK `(highlight_id, destination_id)`, `status`, `attempts`, `error` |
| `activity` | glow ledger | `day` in the reader's time zone, `kind`, `glow` |
| `ideas` | Spark output | `outline` and `source_item_ids` as JSON |
| `ai_usage` | daily quota counter | PK `(user_id, day)`, upserted with `RETURNING count` |
| `topics` | what the radar watches | `source` auto or manual, `muted`; auto topics come from tags |
| `trends` | stories found per user | unique `(user_id, url)`, `score`, `comments`, `dismissed` |
| `radar_runs` | last refresh per user | refreshed every 6 hours by Cron or on view |
| `demo_creations` | demo abuse guard | hashed address, purged daily |

Added in migration 0002: `items.remind_after`, `items.last_opened_at`, `users.share_signals`,
`users.reminders`, `api_tokens.kind` (extension or agent) and `api_tokens.client`.

Added in migration 0007 (LUM-1): `highlight_answers`. The migration moved answers that older
versions wrote into `highlights.note` as `Explain: `, `Define: `, `Summarize: `, `Expand: ` or `Ask: `
into this table and cleared those notes, so `note` holds only the reader's words.

Added in migration 0008 (LUM-2): `answer_deliveries`, backfilled for answers that rode along with
an already delivered highlight.

All foreign keys cascade from `users`, so deleting an account (or purging a demo) removes
everything in one statement. Migrations live in `apps/web/migrations`.
