# Chrome Web Store submission

Everything the developer dashboard asks for, ready to paste. Assets are in
`apps/extension/store/`. `frame.html` frames a 1180x680 screenshot into the 1280x800 store size
(`frame.html?img=shot.png&h=Headline&s=Subline&u=address`), `promo.html` is the 440x280 tile:
open either at that viewport size and take a screenshot.

## Build and upload
1. `npm run build:store -w @lumen/extension` → `apps/extension/.output-store/lumenextension-<version>-chrome.zip`
   (no manifest `key`, no localhost origins).
2. The store assigned the id `hohicfgangllelfkhnbghegnbepjfkkk` on the first upload. It is the default for
   `STORE_EXTENSION_ID` in `apps/web/src/client/lib/extension.ts` (dashboard connect and ping;
   `VITE_EXTENSION_STORE_ID` overrides it) and `STORE_ID` in `apps/native-host/install.sh`
   (Claude helper). Once the listing is public, set `VITE_EXTENSION_STORE_URL` and redeploy: the
   Extension page then shows "Add to Chrome" instead of the zip.
3. Later updates: bump the version in `apps/extension/wxt.config.ts` and `EXTENSION_VERSION` in
   `apps/web/src/worker/index.ts`, build, upload the new zip.

## Store listing

**Name:** Lumen

**Summary** (manifest description, 132 characters max):
Highlight, ask and send what you read to Obsidian, Notion or markdown.

**Category:** Productivity (Tools). **Language:** English.

**Description:**

> Lumen is a calm reading companion for the web. Select any sentence and a small toolbar appears:
> highlight it, add a margin note, or ask what it means, without leaving the page.
>
> Highlight in any colour
> Ten colours, plus a colour wheel or a pasted hex code for anything else. Your highlights come
> back when you return to the page.
>
> Ask about what you are reading
> Explain, define, expand or summarise a passage in a side card. Ask questions in a floating panel
> that answers from the page first, then from everything you have saved, with sources.
>
> Keep it, and send it where you write
> Save pages to your Lumen library, sort them into collections, and send new highlights to
> Obsidian, Notion, a markdown file or a webhook. Each highlight is sent once, never duplicated.
>
> Follow the blogs you like
> One click on any blog, and Lumen tells you when it publishes.
>
> Your model, your choice
> Use Lumen's hosted model, Ollama on your own machine, any OpenAI compatible API with your key,
> or Claude through a small local helper.
>
> Private by default
> Lumen does nothing on a page until you act. Without an account, highlights stay in your browser.
> No ads, no trackers. Open source under the AGPL-3.0.
>
> Shortcuts: Alt+Shift+H highlight, Alt+Shift+S save, Alt+Shift+L panel.

**Single purpose:**
Lumen helps people read on the web: highlight and annotate passages on any page, ask about them,
and keep them in their Lumen reading library.

**Sign in for reviewers:** the demo sandbox needs no account. Google and GitHub sign in need
`GOOGLE_CLIENT_ID`/`SECRET` and `GITHUB_CLIENT_ID`/`SECRET` as Worker secrets (see DEPLOY.md).

**Homepage:** https://readwithlumen.app
**Support:** https://github.com/brgv-code/lumen/issues
**Privacy policy:** https://readwithlumen.app/privacy

## Permission justifications

| Permission | Why |
|---|---|
| Host access to all sites | Reading happens on any site. The content script draws the selection toolbar and restores the user's highlights on the page they are reading; saving reads the page's readable text when the user asks. |
| `scripting` | Adds the toolbar to tabs that were already open when the extension was installed or updated, and reads the current page's text for the panel when the user asks about it. |
| `tabs` | Knows which page the popup and panel are about (its address and title) and opens the dashboard, articles and settings in tabs. |
| `storage` | Settings, the user's highlights when they have no account, and the list of their highlighted pages. |
| `contextMenus` | Right click actions: save page or link, send to a collection, highlight, follow a blog. |
| `sidePanel` | Optional docked panel for Ask, for people who prefer it to the floating panel. |
| `alarms` | Periodic checks for reading reminders and new posts from followed blogs. |
| `notifications` | Tells the user when a blog they follow publishes, if they turned that on. |
| `nativeMessaging` (optional) | Only requested when the user picks "Claude (local CLI)": talks to the Lumen helper on their own computer, which runs the Claude command line tool. |

**Remote code:** No. All code ships in the package. The extension only calls APIs (Lumen, and the
AI provider the user configures). The Geist font is loaded from Google Fonts as CSS.

## Data usage (privacy practices tab)

Collected, and why:

- **Website content:** the text of pages the user saves or highlights, and the selected passage
  when they ask about it. Used to provide saving, highlights and answers.
- **Web history:** the address and title of pages the user acts on (save, highlight, ask, follow,
  open the popup or panel), and lookups for pages they already highlighted, to restore those
  highlights. Pages they never acted on are not sent.
- **Authentication information:** the Lumen access token, stored in the browser and sent to
  Lumen with each request.

Not collected: personally identifiable information through the extension (the account itself is
created on the website), health, financial, personal communications, location, user activity
such as clicks or keystrokes.

Certify all three: not sold to third parties; not used or transferred for purposes unrelated to
the single purpose; not used to determine creditworthiness or for lending.

## Test instructions for reviewers

> The extension works without an account: select text on any article and pick a colour in the
> toolbar; highlights are kept in the browser and come back on reload.
>
> To test syncing: open https://readwithlumen.app/login, choose "Explore the demo
> sandbox", go to Integrations, Extension tab, and press "Connect this browser's extension".
> Highlights, saves and Ask then use the demo library. If the button does not appear, press
> "Or create a token to paste" on the same tab and paste the token into the extension's settings
> (Account section).
>
> "Claude (local CLI)" needs a helper on the user's computer and the Claude command line tool;
> it is optional and only then asks for native messaging.

## Assets
- `store/icon-128.png`: store icon (same as the extension icon).
- `store/screenshot-1-highlight.png`, `-2-colours.png`, `-3-library.png`: 1280×800.
- `store/promo-small-440x280.png`: small promo tile.
