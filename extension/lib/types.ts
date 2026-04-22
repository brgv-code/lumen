export type ActionType = "explain" | "summarize" | "define";

export type SavedItemType = "ai" | "bookmark";

export interface AIItem {
  id: string;
  type: "ai";
  selectedText: string;
  result: string;
  action: ActionType;
  pageTitle: string;
  pageUrl: string;
  timestamp: number;
}

export interface BookmarkItem {
  id: string;
  type: "bookmark";
  pageTitle: string;
  pageUrl: string;
  favicon: string;
  timestamp: number;
}

export type SavedItem = AIItem | BookmarkItem;

export type AIProvider = "ollama" | "openai";

export interface Settings {
  provider: AIProvider;
  ollamaBaseUrl: string;
  openaiBaseUrl: string;
  apiKey: string;
  model: string;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: "ollama",
  ollamaBaseUrl: "http://localhost:11434",
  openaiBaseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "llama3",
};

// Messages between content script and background
export type MessageType =
  | { type: "AI_REQUEST"; text: string; action: ActionType }
  | { type: "AI_STREAM_CHUNK"; chunk: string; done: boolean }
  | { type: "AI_STREAM_ERROR"; error: string }
  | { type: "SAVE_ITEM"; item: Omit<SavedItem, "id"> }
  | { type: "DELETE_ITEM"; id: string }
  | { type: "CLEAR_ALL" }
  | { type: "GET_ITEMS" }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: Settings }
  | { type: "TEST_CONNECTION" };
