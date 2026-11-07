import { BAR_ACTIONS, BAR_SETTINGS_VERSION, DEFAULT_BAR_ACTIONS, type AIAction, type BarAction, type Citation, type Collection, type Highlight, type Item, type TextQuote } from "@lumen/core";

export type Provider = "lumen" | "ollama" | "openai" | "claude";

export interface Settings {
  apiBase: string;          // e.g. https://readwithlumen.app
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
  pdfViewer: boolean;       // open PDF tabs in Lumen's viewer (Pro), where the toolbar works
}

export const TOOLBAR_ACTIONS = BAR_ACTIONS;
export type ToolbarAction = BarAction;

export interface ToolbarSettings {
  enabled: boolean;
  actions: ToolbarAction[];   // shown, in order
  labels: boolean;            // icons only, or icons with words
  disabledSites: string[];    // hostnames where the toolbar stays hidden
  version?: number;           // BAR_SETTINGS_VERSION once upgraded for LUM-1
}

export interface HelperSettings {
  mode: "off" | "chosen" | "everywhere";
  sites: string[];            // hostnames for "chosen"
  hiddenOn: string[];         // hostnames hidden in "everywhere"
  name: string;               // what to call the helper
  side: "right" | "left";
}

export const DEFAULT_SETTINGS: Settings = {
  apiBase: "https://readwithlumen.app",
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
  toolbar: { enabled: true, actions: DEFAULT_BAR_ACTIONS, labels: false, disabledSites: [], version: BAR_SETTINGS_VERSION },
  helper: { mode: "chosen", sites: [], hiddenOn: [], name: "Lumi", side: "right" },
  theme: "system",
  panel: "floating",
  markStyle: "auto",
  markStrength: "soft",
  pdfViewer: true,
};

export interface PageState {
  connected: boolean;
  item: Item | null;
  highlights: Highlight[];
}

export type Msg =
  | { type: "AI_REQUEST"; action: AIAction; text: string; question?: string; title?: string; context?: string }
  | { type: "PAGE_STATE"; url: string; auto?: boolean }
  | { type: "SAVE_PAGE"; url: string; title: string; html: string; kind?: "pdf" }
  | { type: "ADD_HIGHLIGHT"; url: string; title: string; html: string; kind?: "pdf"; quote: TextQuote; color: string; note?: string; collectionId?: string }
  | { type: "UPDATE_HIGHLIGHT"; id: string; url: string; color?: string; note?: string | null }
  | { type: "DELETE_HIGHLIGHT"; id: string; url: string }
  | { type: "AI_TLDR"; title: string; paragraphs: string[] }
  | { type: "KEEP_TLDR"; url: string; title: string; html: string; kind?: "pdf"; text: string; model: string | null; citations: Citation[] }
  | { type: "KEEP_ANSWER"; highlightId: string; url: string; action: AIAction; question: string | null; answer: string; model: string | null; parentId?: string }
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
  | { type: "SAVE_PAGE_TO"; url: string; title: string; html: string; kind?: "pdf"; collectionId?: string; tags?: string[] }
  | { type: "GET_RADAR" }
  | { type: "OPEN_OPTIONS" }
  | { type: "SAVE_URL"; url: string; title?: string }
  | { type: "FOLLOW_SITE"; url: string }
  | { type: "UNFOLLOW_SITE"; id: string }
  | { type: "GET_FOLLOW"; url: string }
  | { type: "PDF_BYPASS"; url: string }
  | { type: "PDF_TAB"; tabId: number; url: string }
  | { type: "PDF_VIEW_IN_LUMEN"; tabId: number; url: string }
  | { type: "PDF_TIMING" };

export type { Collection, Highlight, Item };
