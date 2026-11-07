# The extension

Chrome, Brave, Edge and Arc (Manifest V3, built with WXT). Install it from the
[Chrome Web Store](https://chromewebstore.google.com/detail/lumen/hohicfgangllelfkhnbghegnbepjfkkk)
(short link: https://readwithlumen.app/chrome). For development, load `apps/extension/.output/chrome-mv3`
unpacked: that build has a fixed id (`ffjconacpmnbadoeegamifkellcddfja`) so the dashboard can
connect it in one click.

## Design: one job per surface
Reading should not mean leaving the page. Every surface does one thing, the way the best reading
and AI extensions split their work (one card save popups, a selection action bar, a persistent side
panel, an optional page button with per site control):

| Surface | Job | Opens with |
|---|---|---|
| **Selection toolbar** | Act on a passage without leaving: highlight (hover for colours), note, explain, expand, summary, define, ask, save, copy with link | Selecting text; Alt+Shift+H highlights |
| **Popup** | Save this page to the right collection, with tags | The toolbar icon; Alt+Shift+S |
| **Panel** (floats over the page; can dock) | Ask: chat with this page and your whole Lumen library, answers cite your own highlights and notes. This page: save state, collection, highlights here. For you: today's reads and trending in your topics | "Ask & explore" in the popup, right click, Lumi, Alt+Shift+L |
| **Lumi, the page helper** | A small lamp at the edge of chosen sites: save, summarise, ask, open the panel, hide here | Off, sites you choose (default) or everywhere |
| **Following** | Follow the blog you are on (♡ in the popup, Lumi's menu, or right click); new posts arrive as notifications, checked hourly | The popup, Lumi, right click |
| **Right click** | Save page or link; Send to Lumen ▸ any collection; highlight, explain or ask about a selection; show or hide Lumi on this site | The context menu |

## Settings
- **Appearance:** one theme (match system, light, dark) for every surface; the panel floats over
  the page (default) or docks to the side; highlights adapt to dark pages, or use fill or underline.
- **Selection toolbar:** on or off; which actions, in which order (live preview); words next to
  icons; sites where it stays off (also from ⋯ on the toolbar).
- **Page helper:** name it, never / sites I choose / everywhere, left or right, and the site lists.
- **Account:** one click connect, or paste a token; auto send to the collection's note.
- **Model:** Lumen (hosted), Ollama, OpenAI compatible, or Claude via your CLI. Asking your library
  always goes through Lumen, because that is where your bank lives.
- **Obsidian:** the Local REST API key, kept in the extension only.
- **Reminders** and shortcuts.

## Your knowledge bank stays in Lumen
Sending highlights to Obsidian or Notion is a copy. Every page, highlight, note and answer you keep
also stays in Lumen, which is what Ask searches. "Save to Lumen" on an answer card stores the
passage with the answer as its note.

## Claude through your CLI
The "Claude (local CLI)" model answers Explain, Expand, Summary and Define with your own Claude Code,
on your Claude plan instead of Lumen's daily quota. Asking your library still goes through Lumen.

Extensions cannot start programs, so a small helper in `apps/native-host` does it through Chrome
native messaging: the extension sends the prompt, the helper runs `claude -p --model
<haiku|sonnet|opus>` and streams the answer back. Page text goes in on stdin, never through a
shell. Only `haiku`, `sonnet` and `opus` are accepted.

**You need:** macOS or Linux (Windows is not supported yet), Node, and Claude Code installed and
logged in (`claude -p "hi"` answers in a terminal).

**Set up, once per computer:**
1. Install Lumen from the Chrome Web Store.
2. Get the helper and register it:
   ```bash
   git clone https://github.com/brgv-code/lumen
   cd lumen/apps/native-host
   ./install.sh            # registers for Chrome, Brave, Arc, Edge and Chromium
   ```
   Keep the folder: the browser runs the helper from there. With no arguments it allows both the
   store build and the unpacked dev build; pass extension ids to allow others.
3. Quit the browser fully and open it again. Browsers read helper registrations on start.
4. Lumen settings → **Model** → **Claude (local CLI)**. Allow the "communicate with cooperating
   native applications" prompt; Lumen asks for it only here.
5. Pick Haiku, Sonnet or Opus, **Save**, then **Test**. It should say "Helper ready: node v…".

**If Test fails:**
- "Helper not installed": run `install.sh` again and restart the browser.
- "The Lumen helper stopped" or "claude CLI not found": `claude` was not on PATH when you ran
  `install.sh`. Install Claude Code, then run `install.sh` again.
- "Allow the Claude helper first": pick Claude (local CLI) again and allow the prompt.

What `install.sh` writes: `lumen-host.sh` next to it (the paths to `node` and `claude`), and
`dev.lumen.host.json` in each browser's `NativeMessagingHosts` folder. To remove the helper,
delete both.

## Chrome Web Store
Store build, listing text, permission reasons, data usage answers and assets: [STORE.md](STORE.md).
