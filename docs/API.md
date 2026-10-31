# API

Base URL: `https://lumen.brgv95.workers.dev`. JSON in, JSON out. Errors are always
`{ "error": { "code": "snake_case", "message": "Human sentence." } }`.

## Authentication
| Caller | How | Notes |
|---|---|---|
| Web app | `lumen_session` cookie (HttpOnly, SameSite Lax) | Writes must send `Origin` of this site, or `X-Lumen: 1` |
| Extension, scripts | `Authorization: Bearer lum_…` | Create tokens in Integrations; revoke in Settings. CORS allows extension origins only |

## Auth routes
| Method | Path | Purpose |
|---|---|---|
| GET | `/auth/providers` | `{ google, github, demo }`: which sign in options are configured |
| GET | `/auth/:provider/start?next=/app` | Starts OAuth 2 with PKCE (`google` or `github`) |
| GET | `/auth/:provider/callback` | Exchanges the code, links or creates the user, sets the session, redirects to `next` |
| POST | `/auth/demo` | Creates a seeded sandbox user and a 3 day session |
| POST | `/auth/logout` | Ends the session |

## Account
| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/v1/me` | | `{ user, via }` |
| PATCH | `/api/v1/me` | `{ name?, dailyGoal?, timezone?, aiProvider? }` | `{ user }` |
| DELETE | `/api/v1/me` | cookie only | deletes everything |
| GET | `/api/v1/stats` | | streak, best streak, glow today, goal, total, 7 day series, counts, level |
| GET | `/api/v1/tags` | | `[{ name, count }]` |
| GET | `/api/v1/tokens` | | token metadata (never the secret), with `client`, `calls` and `lastTool` for agents |
| POST | `/api/v1/tokens` | `{ name }`, cookie only | `{ id, token }` shown once |
| DELETE | `/api/v1/tokens/:id` | | |
| GET | `/api/v1/export` | | everything as a JSON download |

## Items
| Method | Path | Body / query | Notes |
|---|---|---|---|
| GET | `/api/v1/items` | `status` (`inbox, reading, done, archived, all`), `collection`, `tag`, `q`, `favorite=1`, `kind`, `cursor`, `limit` ≤ 100 | Keyset paginated `{ data, nextCursor }`; archived hidden unless asked |
| GET | `/api/v1/items/lookup?url=` | | `{ item, highlights }` for a page (tracking params ignored) |
| POST | `/api/v1/items` | `{ url, html?, title?, collectionId?, tags?, status?, kind? }` | Idempotent per URL: returns the existing item with `created: false`. With `html` (extension) the server extracts from it; without, it fetches the URL |
| GET | `/api/v1/items/:id` | | item with `contentHtml` + highlights |
| PATCH | `/api/v1/items/:id` | `{ status?, progress?, favorite?, collectionId?, tags?, title? }` | `done` sets `finished_at` and awards glow once |
| DELETE | `/api/v1/items/:id` | | cascades highlights |

## Highlights
| Method | Path | Body / query | Notes |
|---|---|---|---|
| POST | `/api/v1/items/:id/highlights` | `{ quote, prefix, suffix, position, color, note? }` | colours: `sun, mint, iris, peach, sky`; moves inbox items to reading |
| GET | `/api/v1/highlights` | `color`, `item`, `collection`, `notes=1`, `q`, `cursor`, `limit` ≤ 200 | each includes `item { id, title, url, siteName }` |
| PATCH | `/api/v1/highlights/:id` | `{ color?, note? }` | first note awards glow |
| DELETE | `/api/v1/highlights/:id` | | |

## Collections
| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/v1/collections` | | with `itemCount`, `highlightCount` |
| POST | `/api/v1/collections` | `{ name, emoji?, color?, description?, destinationId? }` | |
| PATCH | `/api/v1/collections/:id` | any of the above, `destinationId: null` to detach | |
| DELETE | `/api/v1/collections/:id` | | items stay, `collection_id` cleared |
| GET | `/api/v1/collections/:id/export.md?format=house\|callout\|plain` | | the whole collection as one note |

## Destinations and delivery
| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/v1/destinations` | | with `pendingCount`, `deliveredCount`, `lastDeliveredAt` |
| POST | `/api/v1/destinations` | `{ kind, name, config, secret? }` | see configs below |
| PATCH | `/api/v1/destinations/:id` | `{ name?, config?, secret? }` | |
| DELETE | `/api/v1/destinations/:id` | | |
| GET | `/api/v1/destinations/:id/pending` | | `{ highlightIds, markdown, groups }`: only highlights this destination has not received |
| POST | `/api/v1/destinations/:id/ack` | `{ highlightIds, error? }` | records delivery; idempotent |
| POST | `/api/v1/destinations/:id/push` | | server delivery for `notion` and `webhook` |

Configs:
- `obsidian`: `{ notePath, baseUrl = https://127.0.0.1:27124, format = house }`. The API key stays on the client.
- `notion`: `{ pageId }` (a link is accepted) and `secret` = integration token.
- `markdown`: `{ fileName, format }`.
- `webhook`: `{ url }` (https) and optional `secret` for `X-Lumen-Signature: sha256=<hmac>`.

Formats: `house` = `==quote==^[note] ([title](link))`, `callout` = Obsidian `> [!quote]`, `plain` = blockquote.
Every link is a text fragment URL (`#:~:text=`) that scrolls to the passage.

Webhook payload:
```json
{ "type": "highlights.created",
  "highlights": [{ "id": "hl_…", "quote": "…", "note": null,
                   "source": { "title": "…", "url": "…", "link": "…#:~:text=…" } }] }
```

## Discover
| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/v1/reads?period=daily\|weekly` | | `{ picks, resurface, trending, minutes, budgetMinutes }`: a plan that fits the daily goal |
| GET | `/api/v1/reminders` | | items in progress, idle 20+ hours, with `minutesLeft` and `idleDays` |
| POST | `/api/v1/items/:id/snooze` | `{ days }` (1 to 30) | hides the reminder until then |
| GET | `/api/v1/radar` | | `{ topics, trends, lastRunAt }`; refreshes if older than 6 hours |
| POST | `/api/v1/radar/refresh` | | forces a refresh |
| POST | `/api/v1/topics` | `{ name }` | follow a topic |
| DELETE | `/api/v1/topics/:name` | | mute a topic (auto topics come from tags) |
| POST | `/api/v1/trends/:id/save` | | saves the story to the library |
| POST | `/api/v1/trends/:id/dismiss` | | hides it |
| GET | `/api/v1/similar` | | readers like you: URLs saved by 2+ readers whose libraries overlap with yours |
| GET | `/api/v1/analytics` | | 84 day heatmap, weekly minutes and words, topics, sites, colours, hours, totals |

`GET /api/v1/items/:id` also returns `alsoSaving`: how many readers like you saved the same URL (0 when fewer than 2).
`PATCH /api/v1/me` accepts `shareSignals` and `reminders` (booleans). `POST /api/v1/tokens` accepts `kind: "agent"`.

## Following (favourite blogs)
| Method | Path | Body / query | Notes |
|---|---|---|---|
| GET | `/api/v1/following` | | followed blogs with unseen counts; stale feeds refresh in the background |
| POST | `/api/v1/following` | `{ url }` (blog or feed) | finds the RSS or Atom feed (link tags, then common paths); free plan follows up to 20 |
| GET | `/api/v1/following/lookup?url=` | | is this site followed |
| PATCH | `/api/v1/following/:id` | `{ notify?, title? }` | |
| DELETE | `/api/v1/following/:id` | | |
| GET | `/api/v1/following/posts` | `unseen=1`, `feed`, `limit` | newest first, with `saved` |
| POST | `/api/v1/following/posts/:id/seen`, `/api/v1/following/seen` | `{ feedId? }` | mark read |
| POST | `/api/v1/following/refresh` | | check now |
| POST | `/api/v1/following/notify` | | new posts not announced yet, marked announced (used by extension notifications) |

Feeds are checked by Cron every 6 hours (oldest first) and whenever Following is opened.

## Shares
| Method | Path | Body / query | Notes |
|---|---|---|---|
| GET | `/api/v1/shares` | | your public share links |
| POST | `/api/v1/shares` | `{ kind: highlight\|progress\|collection, refId, title, payload, image? }` | snapshot of what you chose to share plus a 1200x630 JPEG or PNG data URL (900 KB max); reuses the link for the same kind and refId |
| DELETE | `/api/v1/shares/:id` | | the public page stops working |

Public: `GET /s/:id` (page with Open Graph tags and a "Read with Lumen" pill) and `GET /s/:id/og.jpg` (the preview image). Cards are drawn in the browser on a canvas; only the snapshot and the link image are stored.

## MCP
`POST /mcp` speaks MCP over Streamable HTTP with a Bearer key. See [MCP.md](MCP.md).

## AI
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/v1/ai/run` | `{ action: explain\|summarize\|define\|simplify\|expand\|ask, text, question?, title?, context? }` | `text/event-stream`: `data: {"response":"…"}` … `data: [DONE]` |
| POST | `/api/v1/ai/chat` | `{ question, page?: { title, url, text }, selection?, history? }` | SSE: first `{"sources":[…]}` (numbered library matches), then `{"response":"…"}` chunks; answers cite sources as [n] |
| POST | `/api/v1/ai/spark` | | `{ data: Idea[] }` from the last 30 highlights |
| GET | `/api/v1/ideas` | | ideas not dismissed |
| PATCH | `/api/v1/ideas/:id` | `{ status: new\|saved\|dismissed }` | keeping an idea awards glow |

Daily AI limits: demo 40, Reader 100, Pro 1000 (`429 ai_quota`).

## Glow rules
| Action | Glow |
|---|---|
| Save | 1 |
| Highlight | 2 |
| Note (first on a highlight) | 3 |
| Finish an item | 10 |
| Keep a Spark idea | 2 |

Levels: Spark 0, Candle 50, Lantern 200, Lighthouse 600, Aurora 1500, Sun 4000.

## Error codes
`bad_json`, `unauthorized`, `csrf`, `bad_origin`, `not_found`, `bad_url`, `empty_quote`,
`nothing_to_update`, `no_collection`, `no_destination`, `bad_kind`, `client_delivered`, `demo`,
`push_failed`, `ai_quota`, `ai_unavailable`, `not_enough`, `spark_unparsed`, `internal`.
