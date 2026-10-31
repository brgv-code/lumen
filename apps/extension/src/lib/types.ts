import type { AIAction, Collection, Highlight, Item, TextQuote } from "@lumen/core";

export type Provider = "lumen" | "ollama" | "openai" | "claude";

export interface Settings {
  apiBase: string;          // e.g. https://lumen.brgv95.workers.dev
  token: string;            // personal access token from the dashboard
  provider: Provider;
  ollamaBaseUrl: string;
  openaiBaseUrl: string;
  openaiKey: string;
  model: string;            // ollama / openai model name
  claudeModel: string;      // passed to claude -p --model
  targetCollectionId: string;
  obsidianKey: string;      // Local REST API key, stays in the extension
  autoSend: boolean;        // push new highlights to the target's Obsidian note right away
  reminders: boolean;       // daily nudge for articles left half read
}

export const DEFAULT_SETTINGS: Settings = {
  apiBase: "https://lumen.brgv95.workers.dev",
  token: "",
  provider: "lumen",
  ollamaBaseUrl: "http://localhost:11434",
  openaiBaseUrl: "https://api.openai.com/v1",
  openaiKey: "",
  model: "llama3",
  claudeModel: "sonnet",
  targetCollectionId: "",
  obsidianKey: "",
  autoSend: true,
  reminders: true,
};

export interface PageState {
  connected: boolean;
  item: Item | null;
  highlights: Highlight[];
}

export type Msg =
  | { type: "AI_REQUEST"; action: AIAction; text: string; question?: string; title?: string }
  | { type: "PAGE_STATE"; url: string }
  | { type: "SAVE_PAGE"; url: string; title: string; html: string }
  | { type: "ADD_HIGHLIGHT"; url: string; title: string; html: string; quote: TextQuote; color: string; note?: string }
  | { type: "UPDATE_HIGHLIGHT"; id: string; url: string; color?: string; note?: string | null }
  | { type: "DELETE_HIGHLIGHT"; id: string; url: string }
  | { type: "GET_COLLECTIONS" }
  | { type: "SET_TARGET"; collectionId: string }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: Partial<Settings> }
  | { type: "TEST_CONNECTION" }
  | { type: "SYNC_TARGET" }
  | { type: "OPEN_DASHBOARD"; path?: string }
  | { type: "GET_HOME" };

export type { Collection, Highlight, Item };
