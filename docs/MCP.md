# Connect your agent (MCP)

Lumen is an [MCP](https://modelcontextprotocol.io) server. Any MCP client (Claude Code,
Claude Desktop, Cursor, your own agent) can search your library, read articles together with
your highlights, see what is trending in your topics, save links, highlight passages and suggest
what to write next.

- **Endpoint:** `https://lumen.brgv95.workers.dev/mcp`
- **Transport:** Streamable HTTP (JSON responses), protocol versions `2025-06-18`, `2025-03-26`, `2024-11-05`
- **Auth:** `Authorization: Bearer <key>`. Create a key with **Connect agent** in the dashboard
  (or Integrations). Revoke it in Settings at any time. OAuth discovery is planned.

## Claude Code
```bash
claude mcp add --transport http lumen https://lumen.brgv95.workers.dev/mcp \
  --header "Authorization: Bearer lum_your_key"
```
Then ask: *"Use Lumen to do my weekly reading review."*

## Claude Desktop
Claude Desktop connects to remote servers with a header through `mcp-remote`. Add to
`claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "lumen": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://lumen.brgv95.workers.dev/mcp", "--header", "Authorization:Bearer lum_your_key"]
    }
  }
}
```

## Cursor
`~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "lumen": { "url": "https://lumen.brgv95.workers.dev/mcp", "headers": { "Authorization": "Bearer lum_your_key" } }
  }
}
```

## Tools
| Tool | What it does | Writes? |
|---|---|---|
| `search_library` | Search saved items by text, status, tag or collection | no |
| `get_item` | Full readable text of an item plus your highlights and notes | no |
| `list_highlights` | Highlights and notes across everything, filter by text, colour or notes | no |
| `get_daily_reads` | Today's or this week's reading plan, resurfaced highlights, trending picks | no |
| `get_trending` | Stories trending this week in your topics (Hacker News, dev.to) | no |
| `get_reading_stats` | Streak, glow, level, completion, words read, topics, sources, hours | no |
| `list_collections` | Collections and where their highlights go | no |
| `readers_like_you` | What readers with overlapping libraries saved (anonymous, k ≥ 2) | no |
| `suggest_content` | Writing ideas from your highlights, with sources (saved to Spark) | yes |
| `save_url` | Save a link to the library | yes |
| `add_highlight` | Highlight an exact passage of a saved item, with an optional note | yes |
| `add_note` | Add or replace the note on a highlight | yes |
| `set_status` | Move an item to inbox, reading, done or archived | yes |
| `follow_topic` | Add a topic to your radar | yes |

## Prompts
- `weekly_review`: what you finished, the ideas you keep circling, what is trending that connects, what to write next.
- `what_to_read`: the best next read for the time you have.

## Raw protocol
```bash
curl -s https://lumen.brgv95.workers.dev/mcp \
  -H "Authorization: Bearer lum_your_key" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
Notifications get `202 Accepted`; `GET /mcp` returns `405` (no server initiated streams).

## Security
Keys are personal access tokens stored as SHA-256 hashes. Tools call the same REST endpoints as
the web app, so an agent can never do more than you can. The client name sent at `initialize`
is shown next to the key in Settings so you can see which agent used it.
