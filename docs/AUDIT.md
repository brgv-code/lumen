# Product audit (v2.1)

A review of Lumen through six lenses (product, design, frontend, backend, security, growth), done
on 2026-10-31 before calling the preview "finished". Each finding is either fixed in 2.1 or
listed with a priority.

## Fixed in 2.1
| Lens | Finding | Fix |
|---|---|---|
| Growth | Developer links (API, Architecture) pointed at GitHub docs that only existed on an unmerged branch, so they 404ed | Docs are served by the app at `/docs/*` from the same markdown, with Mermaid diagrams |
| Growth | The whole site was client rendered: nothing for search or answer engines to read | Server rendered comparisons, answers, docs, legal and changelog with JSON-LD (FAQPage, HowTo, Article, BreadcrumbList, SoftwareApplication), canonical URLs, `sitemap.xml`, `robots.txt`, `llms.txt`, Open Graph image |
| Product | No reason to come back daily | Daily and weekly reads, reminders (dashboard and extension notifications), radar of trending topics |
| Product | Discovery only from your own saves | Readers like you (anonymous, k ≥ 2) and the radar |
| Product | Numbers limited to streak and glow | Analytics: 12 week heatmap, completion, minutes and words, topics, sources, colours, reading hours |
| Product | AI only in the margin | MCP server and Connect agent: Claude Code, Claude Desktop, Cursor and any MCP client |
| Product | Pricing promised Team features and a PDF beta that do not exist | Team marked Coming soon, PDF marked coming soon, no fake trial |
| Design | Footer wordmark sat on a flat canvas | Floating tiles, highlight pills, lamplight glow and a halftone band behind it |
| Frontend | Unknown routes redirected home silently | Real not found page (SPA) and a 404 status for unknown server pages |
| Frontend | New users saw empty panels | Three step onboarding card on Home |
| Security | Anyone could create unlimited demo sandboxes | 8 per address per hour, hashed address, purged daily |
| Backend | Workers AI model retired under us | Model ids in one file, friendly `ai_unavailable` |

## Remaining, by priority
| P | Lens | Item | Notes |
|---|---|---|---|
| P0 | Backend | **OAuth apps and secrets** for Google and GitHub | Code is done; needs the consoles and `wrangler secret put` |
| P0 | Security | **MCP OAuth** (authorization server metadata, dynamic client registration) | Needed for Claude Desktop custom connectors without `mcp-remote`; bearer keys work today |
| P1 | Product | Billing (Stripe Checkout + webhook to `users.plan`) and plan limits | Pricing copy is ready |
| P1 | Product | PDF viewer (pdf.js page in the extension, files in R2) | Most requested format |
| P1 | Growth | Chrome Web Store listing | Needs screenshots (in the vault) and a privacy form |
| P1 | Product | Import: Pocket CSV, Readwise, Omnivore, Instapaper | Feeds the alternative pages |
| P1 | Backend | Full text search with D1 FTS5 | `LIKE` is fine until a few thousand items |
| P2 | Product | Weekly email digest (Cron + Email Sending) | Same data as weekly reads |
| P2 | Frontend | Keyboard shortcut sheet (`?`) and command palette | |
| P2 | Backend | Rate limits per token on the API and MCP | Workers rate limiting binding |
| P2 | Growth | More answer pages from real search queries; Search Console | Check impressions after two weeks |
| P3 | Product | Teams: shared collections, roles | |
| P3 | Frontend | Firefox and Safari builds | WXT targets |

## Things deliberately left out
- A social feed or public profiles. Readers like you stays aggregate and anonymous.
- A mascot or loud gamification. Joy comes from the objects, not noise.
- Storing the Obsidian key or vault contents on the server.
