# Lumen

A minimal Chrome extension thats a reading assistant. Highlight text to explain, summarize, or define it, powered by a local Ollama model or any OpenAI-compatible API. Results can be saved to a local library, no account or backend required.

Lumen tooltip appearing over selected text

## Features

- **Text selection toolbar**: highlight any text and a floating toolbar appears with Explain, Summarize, and Define actions
- **Streaming responses**: results appear progressively as the model generates them
- **Save to library**: save any result (text snippet + AI response) with its source page and timestamp
- **Bookmarks**: save pages with one click from the selection toolbar, without triggering any AI call
- **Library popup**: click the toolbar icon to browse saved items and bookmarks in reverse-chronological order
- **Settings page**: toggle between Ollama and OpenAI-compatible APIs, set model name, base URL, and API key
- **Shadow DOM isolation**: the floating UI is injected into a shadow root so it never conflicts with page styles
- **Fully local**: no auth, no backend, no telemetry; all data stays in `chrome.storage.local`

## Stack

- [WXT](https://wxt.dev) — Web Extension framework (Manifest V3)
- React 18 + TypeScript
- Tailwind CSS (injected into shadow DOM, no page style leakage)

## Getting started

### Prerequisites

- Node.js 18+
- Chrome 114+
- [Ollama](https://ollama.com) running locally **or** an OpenAI-compatible API key

### Install and build

```bash
npm install --ignore-scripts
npx wxt prepare
npm run build
```

The built extension is output to `.output/chrome-mv3/`.

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3/` folder

### Dev mode (auto-rebuild on save)

```bash
npm run dev
```

Then load `.output/chrome-mv3/` as above. WXT will rebuild on file changes; reload the extension in `chrome://extensions` to pick up updates, then refresh the tab.

## Ollama setup

Ollama blocks requests from `chrome-extension://` origins by default. You need to allow them:

```bash
OLLAMA_ORIGINS='chrome-extension://*' ollama serve
```

To make this permanent on macOS, add it to your shell profile:

```bash
# ~/.zshrc
export OLLAMA_ORIGINS='chrome-extension://*'
```

Then pull a model if you haven't already:

```bash
ollama pull llama3
```

The default model is `llama3`. You can change it in the Lumen settings page.

## OpenAI-compatible APIs

In the Lumen settings page, switch the provider to **OpenAI-compatible**, set the base URL and API key, and enter the model name. Works with OpenAI, Groq, Together, Mistral, LM Studio, and any other API that follows the `/v1/chat/completions` streaming spec.

## Project structure

```
extension/
├── entrypoints/
│   ├── content/          # Content script — selection detection, tooltip, result panel
│   ├── background/       # Service worker — API calls, storage operations
│   ├── popup/            # Toolbar popup — saved items library
│   └── options/          # Settings page
├── lib/
│   ├── ai.ts             # Ollama + OpenAI streaming clients
│   ├── storage.ts        # chrome.storage.local helpers
│   └── types.ts          # Shared types and message union
└── public/
    └── icons/
```

## How it works

- The **content script** detects text selections and renders the floating toolbar and result panel inside a Shadow DOM (so page CSS can't interfere).
- Action buttons send an `AI_REQUEST` message to the **background service worker**, which owns all `fetch` calls to the AI provider (avoids CORS issues from content scripts).
- The background streams response chunks back to the content script via `chrome.tabs.sendMessage`, which updates the result panel progressively.
- Save/bookmark operations also go through the background worker to `chrome.storage.local`.

## Roadmap

**Reading**

- Summarize the full page with one click (extract visible text or `document.body.innerText`)
- Ask a custom question about the selected text: free-form input in the tooltip
- "Chat with page" sidebar: ongoing conversation about the current page's content
- Reading mode that strips away navigation and ads before summarizing

**Library**

- Search and filter saved items by keyword, action type, or domain
- Tag items manually and filter by tag
- Export library to JSON or Markdown
- Sync library across devices via a self-hosted endpoint (keep it optional, no cloud dependency)

**AI**

- Per-action system prompts: let the user customize the prompt for Explain, Summarize, and Define separately
- Multiple model profiles: switch between models quickly without going into settings
- Response length control (short / detailed)
- Translate selection to a target language

**UX**

- Keyboard shortcut to trigger the last-used action on current selection
- Pin the result panel so it stays open while scrolling
- Right-click context menu as an alternative to the floating toolbar
- Dark/light theme toggle independent of system preference

## License

MIT
