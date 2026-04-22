import type { SavedItem, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const ITEMS_KEY = "lumen_items";
const SETTINGS_KEY = "lumen_settings";

export async function getItems(): Promise<SavedItem[]> {
  const result = await chrome.storage.local.get(ITEMS_KEY);
  return result[ITEMS_KEY] ?? [];
}

export async function saveItem(item: Omit<SavedItem, "id">): Promise<SavedItem> {
  const items = await getItems();
  const newItem = { ...item, id: crypto.randomUUID() } as SavedItem;
  await chrome.storage.local.set({ [ITEMS_KEY]: [newItem, ...items] });
  return newItem;
}

export async function deleteItem(id: string): Promise<void> {
  const items = await getItems();
  await chrome.storage.local.set({
    [ITEMS_KEY]: items.filter((i) => i.id !== id),
  });
}

export async function clearAllItems(): Promise<void> {
  await chrome.storage.local.set({ [ITEMS_KEY]: [] });
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] ?? {}) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}
