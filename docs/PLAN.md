# Lumen: product plan

Lumen is a reading companion: save what you want to read, highlight and annotate it,
ask a model about any passage, and send what matters to the notes app you already use.

## The problem it solves

Web clippers treat highlighting as a separate mode and treat every clip as a new note.
While researching a piece of writing that breaks three ways:

1. **Highlighting blocks copying.** In highlighter mode every selection becomes a highlight,
   so a passage cannot be copied into another page or an LLM.
2. **No choice of destination.** A second clip lands in a new note instead of the note you are
   writing, and clipping the same page again duplicates every highlight.
3. **PDFs and images are out of reach.** Chrome's PDF viewer cannot be scripted by extensions.

## Principles

- **Never take over the selection.** A toolbar appears next to a selection; Ctrl+C always works.
- **A destination is a note.** Collections point at one note (Obsidian, Notion, a markdown file,
  a webhook). New highlights flow there, once each, recorded in a delivery ledger.
- **Platform agnostic.** Markdown is the lingua franca. Lumen's own store is the source of truth
  and every integration is just a sink.
- **Bring your own model.** Lumen's hosted model, Ollama, any OpenAI compatible API, or Claude
  through the local CLI.
- **Joy from objects, not noise.** Calm gray surfaces; glossy keys and tiles; a glow streak that
  rewards attention, not volume.

## Scope

### Shipped in this version (v2)
| Area | Feature |
|---|---|
| Auth | Google and GitHub SSO (OAuth 2 with PKCE), account linking by verified email, 30 day sessions, demo sandbox |
| Library | Save by URL (server extraction) or from the extension (page HTML), reader view, inbox / reading / done / archived, favourites, tags, collections, search, keyset pagination |
| Reader | Serif reader, selection toolbar, five highlight colours, margin notes, copy with citation and text fragment link, progress tracking, finish celebration |
| AI | Explain, define, simplify, summarise, ask; streamed; Workers AI with daily quotas |
| Spark | Writing ideas generated only from your highlights, each citing sources |
| Destinations | Obsidian (Local REST API, client delivered), Notion (server push), Markdown download, signed webhooks; delivery ledger guarantees once only |
| Glow | Points ledger, streaks, daily goal, levels |
| Extension | Selection toolbar, persistent highlights, target collection picker, auto send, local only mode, context menu, keyboard shortcuts, four AI providers |
| Claude | Native messaging helper that runs `claude -p --model <m>` |
| Data | JSON export, collection export as markdown, account deletion |

### Shipped in 2.1
| Area | Feature |
|---|---|
| Agents | MCP server (14 tools, 2 prompts), Connect agent flow, agent keys with client names |
| Discover | Radar (Hacker News, dev.to) per topic, follow and mute topics, save trending stories |
| Habit | Daily and weekly reads within the time budget, resurfaced highlights, reminders with snooze, extension notifications |
| Social | Readers like you (anonymous, at least two readers), per item "readers like you saved this" |
| Insight | Analytics page |
| Growth | Docs, comparisons, answers, legal and changelog pages with structured data; sitemap, robots, llms.txt, Open Graph image |

### Shipped in 2.2
| Area | Feature |
|---|---|
| Business | Freemium: free plan forever (library, highlights, notes, collections, extension, Obsidian and markdown, daily reads, reminders, export); 7 day Pro trial (Spark, Radar, agents, analytics, Notion and webhooks, 500 hosted answers a day); paywall and in app pricing; Stripe Checkout, portal and webhook ready |
| Onboarding | Welcome card and a ten step spotlight tour, replayable from Settings or the `?` button |
| Extension | Dark mode, custom collection picker, create a collection and a new Obsidian note from the popup, ask about the page in the popup, Summarize in the toolbar |
| License | AGPL-3.0 |

### Next
| Priority | Feature | Notes |
|---|---|---|
| P1 | PDF highlighting | Open PDF links in a bundled pdf.js viewer page inside the extension; store files in R2 |
| P1 | Billing | Stripe Checkout + webhook to flip `users.plan`; enforce Pro limits |
| P0 | MCP OAuth | Authorization server metadata and dynamic client registration for native Claude connectors |
| P1 | Email magic link | Cloudflare Email Sending; same session machinery |
| P1 | Imports | Pocket CSV, Readwise, Omnivore, Instapaper |
| P2 | Image and region clips | `captureVisibleTab`, crop, optional OCR, stored in R2 |
| P2 | Full text search | D1 FTS5 table over items and highlights |
| P2 | Shared collections (Team) | `collection_members` table, roles |
| P3 | Weekly digest | Cron Trigger + email of the week's highlights and Spark ideas |
| P3 | Firefox and Safari builds | WXT targets; Safari needs the Xcode wrapper |

## Milestones
1. **M1 Core (done):** schema, API, auth, web app, reader, highlights, ledger.
2. **M2 Capture (done):** extension rewrite on the shared core, destinations, Claude helper.
3. **M3 Money:** billing, plan limits, email login.
4. **M4 Formats:** PDFs, images, FTS.
5. **M5 Together:** teams, digests, other browsers.

## Success measures
- A reader highlights 3+ passages in their first session (activation).
- 40% of weekly actives have a collection with a destination (the core promise).
- Zero duplicate deliveries (ledger correctness; alert on `deliveries.attempts > 3`).
