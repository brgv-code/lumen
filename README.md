# Lumen

**Read slowly. Keep what glows.**

Lumen is a reading companion for the web. Save what you want to read, highlight it in five
colours, leave margin notes, ask a model about any passage, and send what matters to the notes
app you already use: Obsidian, Notion, a markdown file or a webhook.

**Live preview:** https://lumen.brgv95.workers.dev (press "Explore the demo" for a sandbox account)

Free plan forever for reading, highlighting and syncing; every new account gets 7 days of Pro
(Spark, Radar, agents over MCP, analytics, Notion and webhooks).

## Why

Web clippers make highlighting a mode (so you cannot copy while highlighting), drop every clip
into a new note, duplicate highlights when you clip a page twice, and cannot touch PDFs. Lumen:

- **never takes over your selection.** A toolbar appears next to it; Ctrl+C always works.
- **sends highlights to the note you choose.** Each collection points at one destination.
- **writes each highlight once.** A delivery ledger remembers what every destination received.
- **works with any notes app.** Markdown is the format; integrations are just places it goes.
- **lets you pick the model.** Lumen's hosted model, Ollama, any OpenAI compatible API, or Claude via your local CLI.

## New in 2.1
- **Connect your agent:** Lumen is an MCP server for Claude Code, Claude Desktop, Cursor and others ([docs/MCP.md](docs/MCP.md)).
- **Radar:** trending stories this week in your topics (Hacker News, dev.to).
- **Daily and weekly reads, reminders, readers like you, analytics.**
- **Docs, comparisons and answers** served as crawlable pages, with sitemap, robots and llms.txt.

## What is in the box

| Part | What it does |
|---|---|
| Web app | Landing page, SSO (Google, GitHub), dashboard, library, reader view with highlights and notes, collections, Spark writing ideas, integrations, settings, export |
| API | Cloudflare Worker (Hono) on D1, Workers AI for margin answers; see [docs/API.md](docs/API.md) |
| MCP | `/mcp` for agents: search, read, highlight, save, trends, stats, content ideas |
| Site | Server rendered docs, comparisons and answers for search and answer engines |
| Extension | Selection toolbar on any page, persistent highlights, target collection picker, auto send to Obsidian, four AI providers |
| Claude helper | Native messaging host that runs `claude -p --model <haiku/sonnet/opus>` |
| Core | Shared anchoring, citation links, markdown formats and glow rules, with tests |

## Quick start
```bash
npm install
npm run db:migrate:local -w @lumen/web
npm run build -w @lumen/web && npm run dev:api -w @lumen/web   # http://localhost:8787
npm run build -w @lumen/extension                               # load apps/extension/.output/chrome-mv3
```
Node 22+ required. Full instructions, SSO setup and deployment: [docs/DEPLOY.md](docs/DEPLOY.md).

## Docs
- [Plan](docs/PLAN.md): problem, principles, scope, roadmap
- [Architecture](docs/ARCHITECTURE.md): system diagram, decisions, request flows, security
- [State diagrams](docs/STATES.md): item lifecycle, delivery ledger, sessions, toolbar, AI, glow
- [API](docs/API.md): every endpoint, payload and error code
- [Data model](docs/DATA_MODEL.md): tables and relations
- [Deploy](docs/DEPLOY.md): local, Cloudflare, SSO, extension, Claude helper
- [MCP](docs/MCP.md): connect Claude, Cursor or any agent
- [Extension](docs/EXTENSION.md): toolbar, shortcuts, providers, reminders
- [Audit](docs/AUDIT.md): what was reviewed, fixed, and what is left

## Stack
Cloudflare Workers + D1 + Workers AI · Hono · React 18 + Vite · WXT (Manifest V3) · TypeScript.

## Version 1
The original Lumen was a small extension for explaining selected text with Ollama. Its demo is
kept at [docs/media/lumen-v1-demo.gif](docs/media/lumen-v1-demo.gif).

## License
Copyright (C) 2026 Bhargav Venkatesh Babu.

Lumen is free software under the [GNU Affero General Public License v3.0](LICENSE). You may use,
study, modify and share it; if you run a modified version as a service for others, you must
offer them its source code under the same license. For other licensing, open an issue.
