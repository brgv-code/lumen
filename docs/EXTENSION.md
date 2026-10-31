# The extension

Chrome (Manifest V3, built with WXT). Load `apps/extension/.output/chrome-mv3` unpacked until
it is in the Chrome Web Store.

## On any page
| Action | How |
|---|---|
| Highlight | Select text, pick a colour in the toolbar, or press **Alt+Shift+H** |
| Note | Toolbar **Note**, or click an existing highlight |
| Copy with citation | Toolbar **Copy**: quote, title and a link that scrolls back to the passage. Plain Ctrl+C always works too |
| Explain, Define, Ask | Toolbar buttons; the answer streams into a card |
| Save the page | **Alt+Shift+S**, the popup, or right click → Save page to Lumen |
| Change or delete a highlight | Click it |

Highlights are stored as a quote plus the text around it, so they reappear when you come back
even if the layout changed. Without an account they stay in the browser (local mode).

## Popup
Shows the page's state, saves it, and sets the **target collection**: the project you are
reading for. Highlights go into that collection and, if it has a destination, are sent there
once each (automatically if auto send is on).

## Settings
- **Account:** Lumen address and an access token from Integrations.
- **Model:** Lumen (hosted), Ollama (local), OpenAI compatible, or Claude (local CLI).
- **Obsidian:** the Local REST API key, kept in the extension only.
- **Reminders:** a daily nudge for articles you started and left (uses Chrome notifications).

## Claude through your CLI
The extension cannot start programs, so a small helper does it through Chrome native messaging:
```bash
apps/native-host/install.sh <extension-id>
```
The helper runs `claude -p --model <haiku|sonnet|opus>` and streams the answer back. The page
text goes in on stdin, never through a shell.
