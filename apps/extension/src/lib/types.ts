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
  toolbar: ToolbarSettings;
  helper: HelperSettings;
  theme: "system" | "light" | "dark";   // drives every Lumen surface
  panel: "floating" | "docked";         // floating over the page, or Chrome's side panel
  markStyle: "auto" | "fill" | "underline"; // auto adapts to dark pages
  markStrength: "soft" | "medium" | "strong";
}

export const TOOLBAR_ACTIONS = ["highlight", "note", "explain", "expand", "summarize", "define", "ask", "save", "copy"] as const;
export type ToolbarAction = (typeof TOOLBAR_ACTIONS)[number];

export interface ToolbarSettings {
  enabled: boolean;
  actions: ToolbarAction[];   // shown, in order
  labels: boolean;            // icons only, or icons with words
  disabledSites: string[];    // hostnames where the toolbar stays hidden
}

export interface HelperSettings {
  mode: "off" | "chosen" | "everywhere";
  sites: string[];            // hostnames for "chosen"
  hiddenOn: string[];         // hostnames hidden in "everywhere"
  name: string;               // what to call the helper
  side: "right" | "left";
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
  toolbar: { enabled: true, actions: ["highlight", "note", "explain", "expand", "summarize", "save", "copy"], labels: false, disabledSites: [] },
  helper: { mode: "chosen", sites: [], hiddenOn: [], name: "Lumi", side: "right" },
  theme: "system",
  panel: "floating",
  markStyle: "auto",
  markStrength: "soft",
};

export interface PageState {
  connected: boolean;
  item: Item | null;
  highlights: Highlight[];
}

export type Msg =
  | { type: "AI_REQUEST"; action: AIAction; text: string; question?: string; title?: string; context?: string }
  | { type: "PAGE_STATE"; url: string; auto?: boolean }
  | { type: "SAVE_PAGE"; url: string; title: string; html: string }
  | { type: "ADD_HIGHLIGHT"; url: string; title: string; html: string; quote: TextQuote; color: string; note?: string; collectionId?: string }
  | { type: "UPDATE_HIGHLIGHT"; id: string; url: string; color?: string; note?: string | null }
  | { type: "DELETE_HIGHLIGHT"; id: string; url: string }
  | { type: "GET_COLLECTIONS" }
  | { type: "SET_TARGET"; collectionId: string }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: Partial<Settings> }
  | { type: "TEST_CONNECTION" }
  | { type: "SYNC_TARGET" }
  | { type: "OPEN_DASHBOARD"; path?: string }
  | { type: "GET_HOME" }
  | { type: "GET_DESTINATIONS" }
  | { type: "CREATE_COLLECTION"; name: string; emoji: string; destinationId?: string; obsidianNote?: string }
  | { type: "OPEN_PANEL"; prompt?: string; tabId?: number }
  | { type: "SET_HELPER_SITE"; host: string; on: boolean }
  | { type: "SET_TOOLBAR_SITE"; host: string; on: boolean }
  | { type: "SAVE_PAGE_TO"; url: string; title: string; html: string; collectionId?: string; tags?: string[] }
  | { type: "GET_RADAR" }
  | { type: "OPEN_OPTIONS" }
  | { type: "SAVE_URL"; url: string; title?: string }
  | { type: "FOLLOW_SITE"; url: string }
  | { type: "UNFOLLOW_SITE"; id: string }
  | { type: "GET_FOLLOW"; url: string };

export type { Collection, Highlight, Item };
