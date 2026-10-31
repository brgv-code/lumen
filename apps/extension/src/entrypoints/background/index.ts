import type { Highlight } from "@lumen/core";
import { streamAnswer, testProvider } from "../../lib/ai";
import { cloud, cloudApi, syncTarget } from "../../lib/cloud";
import { getSettings, localHighlights, pageKey, saveSettings, setLocalHighlights } from "../../lib/storage";
import type { Msg, PageState } from "../../lib/types";

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((msg: Msg, sender, reply) => {
    handle(msg, sender).then(reply, (e) => reply({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    return true;
  });

  chrome.runtime.onInstalled.addListener((d) => {
    chrome.contextMenus.create({ id: "lumen-highlight", title: "Highlight with Lumen", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "lumen-explain", title: "Explain with Lumen", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "lumen-save", title: "Save page to Lumen", contexts: ["page"] });
    if (d.reason === "install") chrome.runtime.openOptionsPage();
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.id) return;
    const cmd = info.menuItemId === "lumen-highlight" ? "highlight" : info.menuItemId === "lumen-explain" ? "explain" : "save";
    chrome.tabs.sendMessage(tab.id, { type: "CMD", cmd }).catch(() => {});
  });

  // Reminders: a gentle nudge for articles you started and left.
  chrome.alarms.create("lumen-reminders", { periodInMinutes: 240, delayInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((a) => { if (a.name === "lumen-reminders") checkReminders().catch(() => {}); });
  chrome.notifications.onClicked.addListener(async (nid) => {
    if (!nid.startsWith("lumen-remind-")) return;
    const s = await getSettings();
    chrome.tabs.create({ url: `${s.apiBase}/app/read/${nid.slice("lumen-remind-".length)}` });
    chrome.notifications.clear(nid);
  });

  chrome.commands.onCommand.addListener(async (command) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "CMD", cmd: command === "save-page" ? "save" : "highlight" }).catch(() => {});
  });
});

async function connected() {
  return Boolean((await getSettings()).token);
}

async function ensureItem(url: string, title: string, html: string) {
  const found = await cloudApi.lookup(url);
  if (found.item) return found.item;
  const s = await getSettings();
  const r = await cloudApi.save({ url, title, html, collectionId: s.targetCollectionId || undefined });
  return r.item;
}

async function autoSend(tabId?: number) {
  const s = await getSettings();
  if (!s.autoSend || !s.targetCollectionId) return;
  try {
    const r = await syncTarget();
    if (r.sent && tabId !== undefined) chrome.tabs.sendMessage(tabId, { type: "TOAST", text: `Sent ${r.sent} to ${r.to}` }).catch(() => {});
  } catch (e) {
    if (tabId !== undefined) chrome.tabs.sendMessage(tabId, { type: "TOAST", text: e instanceof Error ? e.message : "Could not send", tone: "err" }).catch(() => {});
  }
}

async function handle(msg: Msg, sender: chrome.runtime.MessageSender): Promise<unknown> {
  const tabId = sender.tab?.id;
  switch (msg.type) {
    case "AI_REQUEST": {
      const s = await getSettings();
      const send = (m: object) => tabId !== undefined && chrome.tabs.sendMessage(tabId, m).catch(() => {});
      streamAnswer(msg, s, {
        chunk: (chunk) => send({ type: "AI_CHUNK", chunk }),
        done: () => send({ type: "AI_DONE" }),
        error: (error) => send({ type: "AI_ERROR", error }),
      });
      return { ok: true, provider: s.provider };
    }

    case "PAGE_STATE": {
      const url = pageKey(msg.url);
      if (!(await connected())) return { connected: false, item: null, highlights: await localHighlights(url) } satisfies PageState;
      try {
        const r = await cloudApi.lookup(url);
        return { connected: true, item: r.item, highlights: r.highlights } satisfies PageState;
      } catch {
        return { connected: true, item: null, highlights: [] } satisfies PageState;
      }
    }

    case "SAVE_PAGE": {
      if (!(await connected())) return { ok: false, error: "Connect Lumen in settings to save pages." };
      const item = await ensureItem(pageKey(msg.url), msg.title, msg.html);
      return { ok: true, item };
    }

    case "ADD_HIGHLIGHT": {
      const url = pageKey(msg.url);
      if (!(await connected())) {
        const now = Date.now();
        const h: Highlight = { ...msg.quote, id: "local_" + now.toString(36), itemId: "local", color: msg.color as Highlight["color"], note: msg.note ?? null, createdAt: now, updatedAt: now };
        await setLocalHighlights(url, [...(await localHighlights(url)), h]);
        return { ok: true, highlight: h, local: true };
      }
      const item = await ensureItem(url, msg.title, msg.html);
      const r = await cloudApi.addHighlight(item.id, { ...msg.quote, color: msg.color, note: msg.note });
      autoSend(tabId);
      return { ok: true, highlight: r.highlight };
    }

    case "UPDATE_HIGHLIGHT": {
      if (msg.id.startsWith("local_")) {
        const url = pageKey(msg.url);
        const list = (await localHighlights(url)).map((h) => (h.id === msg.id ? { ...h, ...(msg.color ? { color: msg.color as Highlight["color"] } : {}), ...(msg.note !== undefined ? { note: msg.note } : {}) } : h));
        await setLocalHighlights(url, list);
        return { ok: true, highlight: list.find((h) => h.id === msg.id) };
      }
      const r = await cloudApi.updateHighlight(msg.id, { color: msg.color, note: msg.note });
      if (msg.note) autoSend(tabId);
      return { ok: true, highlight: r.highlight };
    }

    case "DELETE_HIGHLIGHT": {
      if (msg.id.startsWith("local_")) {
        const url = pageKey(msg.url);
        await setLocalHighlights(url, (await localHighlights(url)).filter((h) => h.id !== msg.id));
        return { ok: true };
      }
      await cloudApi.deleteHighlight(msg.id);
      return { ok: true };
    }

    case "GET_COLLECTIONS":
      return { ok: true, collections: (await connected()) ? (await cloudApi.collections()).data : [] };

    case "SET_TARGET":
      await saveSettings({ targetCollectionId: msg.collectionId });
      return { ok: true };

    case "GET_SETTINGS":
      return { ok: true, settings: await getSettings() };

    case "SAVE_SETTINGS":
      return { ok: true, settings: await saveSettings(msg.settings) };

    case "TEST_CONNECTION":
      return testProvider(await getSettings());

    case "SYNC_TARGET":
      return { ok: true, ...(await syncTarget()) };

    case "OPEN_DASHBOARD": {
      const s = await getSettings();
      await chrome.tabs.create({ url: `${s.apiBase}${msg.path ?? "/app"}` });
      return { ok: true };
    }
  }
}

async function checkReminders() {
  const s = await getSettings();
  if (!s.token || !s.reminders) { chrome.action.setBadgeText({ text: "" }); return; }
  const r = await cloud<{ data: { item: { id: string; title: string; progress: number }; minutesLeft: number }[] }>("GET", "/reminders");
  chrome.action.setBadgeBackgroundColor({ color: "#FF8A1F" });
  chrome.action.setBadgeText({ text: r.data.length ? String(r.data.length) : "" });
  if (!r.data.length) return;
  const today = new Date().toISOString().slice(0, 10);
  const key = "lumen_reminded";
  const seen: Record<string, string> = (await chrome.storage.local.get(key))[key] ?? {};
  const next = r.data.find((x) => seen[x.item.id] !== today);
  if (!next) return;
  seen[next.item.id] = today;
  await chrome.storage.local.set({ [key]: seen });
  chrome.notifications.create(`lumen-remind-${next.item.id}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Pick up where you left off",
    message: `You were ${Math.round(next.item.progress * 100)}% through “${next.item.title}”. About ${next.minutesLeft} min to finish.`,
    priority: 0,
  });
}
