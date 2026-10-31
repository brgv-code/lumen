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

  // One click connect from the Lumen dashboard (only the origins in externally_connectable can call this).
  chrome.runtime.onMessageExternal.addListener((msg: { type?: string; token?: string }, sender, reply) => {
    (async () => {
      const origin = sender.origin ?? (sender.url ? new URL(sender.url).origin : "");
      if (msg?.type === "LUMEN_PING") {
        const s = await getSettings();
        return reply({ ok: true, version: chrome.runtime.getManifest().version, connected: Boolean(s.token), apiBase: s.apiBase });
      }
      if (msg?.type === "LUMEN_CONNECT" && typeof msg.token === "string" && msg.token.startsWith("lum_") && origin) {
        await saveSettings({ token: msg.token, apiBase: origin });
        buildMenus();
        return reply({ ok: true });
      }
      reply({ ok: false });
    })();
    return true;
  });

  // Ports: margin answers for the popup, library chat for the side panel.
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "lumen-ai") {
      port.onMessage.addListener(async (req: { action: "explain" | "summarize" | "define" | "ask" | "expand"; text: string; question?: string; title?: string }) => {
        const s = await getSettings();
        port.postMessage({ provider: s.provider });
        streamAnswer(req, s, {
          chunk: (chunk) => safePost(port, { chunk }),
          done: () => safePost(port, { done: true }),
          error: (error) => safePost(port, { error }),
        });
      });
    }
    if (port.name === "lumen-chat") {
      port.onMessage.addListener((req: { question: string; page?: { title: string; url: string; text: string }; selection?: string; history?: { role: string; content: string }[] }) => chat(port, req));
    }
  });

  chrome.runtime.onInstalled.addListener((d) => {
    buildMenus();
    injectIntoOpenTabs();
    if (d.reason === "install") chrome.runtime.openOptionsPage();
  });
  chrome.runtime.onStartup.addListener(() => buildMenus());
  chrome.contextMenus.onClicked.addListener((info, tab) => onMenu(info, tab).catch(() => {}));
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {});

  chrome.commands.onCommand.addListener(async (command) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (command === "open-panel" && tab) { openPanelFor(tab, undefined, true); return; }
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "CMD", cmd: command === "save-page" ? "save" : "highlight" }).catch(() => {});
  });

  // Reminders: a gentle nudge for articles you started and left.
  chrome.alarms.create("lumen-reminders", { periodInMinutes: 240, delayInMinutes: 1 });
  chrome.alarms.create("lumen-menus", { periodInMinutes: 60 });
  chrome.alarms.create("lumen-follow", { periodInMinutes: 60, delayInMinutes: 2 });
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === "lumen-reminders") checkReminders().catch(() => {});
    if (a.name === "lumen-menus") buildMenus();
    if (a.name === "lumen-follow") checkNewPosts().catch(() => {});
  });
  chrome.notifications.onClicked.addListener(async (nid) => {
    if (nid.startsWith("lumen-post-")) {
      const map = (await chrome.storage.local.get("lumen_post_urls")).lumen_post_urls ?? {};
      const target = map[nid];
      const s = await getSettings();
      chrome.tabs.create({ url: target?.url ?? `${s.apiBase}/app/following` });
      if (target?.id) cloud("POST", `/following/posts/${target.id}/seen`, {}).catch(() => {});
      chrome.notifications.clear(nid);
      return;
    }
    if (!nid.startsWith("lumen-remind-")) return;
    const s = await getSettings();
    chrome.tabs.create({ url: `${s.apiBase}/app/read/${nid.slice("lumen-remind-".length)}` });
    chrome.notifications.clear(nid);
  });
});

/** Floating panel in the page by default; Chrome's docked side panel if chosen in settings. */
async function openPanelFor(tab: chrome.tabs.Tab, prompt?: string, toggle = false) {
  const s = await getSettings();
  if (s.panel === "docked") {
    await chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
    if (prompt) setTimeout(() => chrome.runtime.sendMessage({ type: "PANEL_PROMPT", prompt }).catch(() => {}), 500);
    return;
  }
  if (tab.id !== undefined) chrome.tabs.sendMessage(tab.id, toggle ? { type: "TOGGLE_PANEL" } : { type: "SHOW_PANEL", prompt }).catch(() => {});
}

/** After install or update, existing tabs have no (or a stale) content script: add the current one. */
async function injectIntoOpenTabs() {
  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
  if (!files.length) return;
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const t of tabs) {
    if (t.id === undefined || t.discarded) continue;
    chrome.scripting.executeScript({ target: { tabId: t.id }, files }).catch(() => {});
  }
}

function safePost(port: chrome.runtime.Port, m: object) {
  try { port.postMessage(m); } catch { /* closed */ }
}

/* ---------------- right click menus ---------------- */

let building = false;
async function buildMenus() {
  if (building) return;
  building = true;
  try {
    await chrome.contextMenus.removeAll();
    const s = await getSettings();
    const add = (o: chrome.contextMenus.CreateProperties) => chrome.contextMenus.create(o, () => void chrome.runtime.lastError);
    add({ id: "save-page", title: "Save page to Lumen", contexts: ["page"] });
    add({ id: "save-link", title: "Save link to Lumen", contexts: ["link"] });
    add({ id: "follow", title: "Follow this blog in Lumen", contexts: ["page"] });
    add({ id: "highlight", title: "Highlight with Lumen", contexts: ["selection"] });
    add({ id: "explain", title: "Explain with Lumen", contexts: ["selection"] });
    add({ id: "ask", title: "Ask Lumen about “%s”", contexts: ["selection"] });
    let cols: { id: string; name: string; emoji: string }[] = [];
    if (s.token) cols = (await cloudApi.collections().catch(() => ({ data: [] }))).data as typeof cols;
    if (cols.length) {
      add({ id: "send", title: "Send to Lumen", contexts: ["page", "selection", "link"] });
      for (const c of cols.slice(0, 12)) add({ id: `send:${c.id}`, parentId: "send", title: `${c.emoji} ${c.name}`, contexts: ["page", "selection", "link"] });
    }
    add({ id: "sep", type: "separator", contexts: ["page"] });
    add({ id: "panel", title: "Open the Lumen panel", contexts: ["page", "selection"] });
    add({ id: "helper", title: `Show or hide ${s.helper.name} on this site`, contexts: ["page"] });
  } finally {
    building = false;
  }
}

async function onMenu(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) {
  if (!tab?.id) return;
  const id = String(info.menuItemId);
  const tabMsg = (m: object) => chrome.tabs.sendMessage(tab.id!, m).catch(() => {});
  if (id === "panel" || id === "ask") {
    const prompt = id === "ask" && info.selectionText ? `What does this mean: “${info.selectionText}”` : undefined;
    return openPanelFor(tab, prompt);
  }
  if (id === "save-page") return tabMsg({ type: "CMD", cmd: "save" });
  if (id === "follow" && tab.url) {
    const r = await cloud<{ feed: { title: string }; created: boolean }>("POST", "/following", { url: tab.url }).catch((e) => ({ error: (e as Error).message }));
    return tabMsg({ type: "TOAST", text: "error" in r ? r.error : r.created ? `Following ${r.feed.title}. You'll hear when it publishes.` : `Already following ${r.feed.title}`, tone: "error" in r ? "err" : "ok" });
  }
  if (id === "highlight") return tabMsg({ type: "CMD", cmd: "highlight" });
  if (id === "explain") return tabMsg({ type: "CMD", cmd: "explain" });
  if (id === "save-link" && info.linkUrl) {
    const r = await cloudApi.save({ url: info.linkUrl }).catch((e) => ({ error: String(e) }));
    return tabMsg({ type: "TOAST", text: "error" in r ? "Could not save the link" : "Link saved to Lumen · +1 glow" });
  }
  if (id === "helper") {
    const host = tab.url ? new URL(tab.url).hostname : "";
    const s = await getSettings();
    const shown = s.helper.mode === "everywhere" ? !s.helper.hiddenOn.includes(host) : s.helper.sites.includes(host);
    await setHelperSite(host, !shown);
    return tabMsg({ type: "TOAST", text: shown ? `${s.helper.name} hidden on ${host}` : `${s.helper.name} will keep you company on ${host}` });
  }
  if (id.startsWith("send:")) {
    const collectionId = id.slice(5);
    if (info.linkUrl && !info.selectionText) {
      await cloudApi.save({ url: info.linkUrl, collectionId }).catch(() => {});
      return tabMsg({ type: "TOAST", text: "Link sent to Lumen" });
    }
    return tabMsg({ type: "CMD", cmd: info.selectionText ? "send-selection" : "save", collectionId });
  }
}

async function setHelperSite(host: string, on: boolean) {
  const s = await getSettings();
  const h = { ...s.helper };
  if (h.mode === "everywhere") h.hiddenOn = on ? h.hiddenOn.filter((x) => x !== host) : [...new Set([...h.hiddenOn, host])];
  else {
    if (h.mode === "off" && on) h.mode = "chosen";
    h.sites = on ? [...new Set([...h.sites, host])] : h.sites.filter((x) => x !== host);
  }
  await saveSettings({ helper: h });
}

/* ---------------- library chat (side panel) ---------------- */

async function chat(port: chrome.runtime.Port, req: { question: string; page?: unknown; selection?: string; history?: unknown[] }) {
  const s = await getSettings();
  if (!s.token) return safePost(port, { error: "Connect Lumen in settings to ask your library." });
  try {
    const res = await fetch(`${s.apiBase}/api/v1/ai/chat`, {
      method: "POST",
      headers: { authorization: `Bearer ${s.token}`, "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      let m = `Lumen answered ${res.status}`;
      try { m = (await res.json()).error?.message ?? m; } catch { /* */ }
      return safePost(port, { error: m, upgrade: res.status === 402 });
    }
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (d === "[DONE]") return safePost(port, { done: true });
        try {
          const j = JSON.parse(d);
          if (j.sources) safePost(port, { sources: j.sources });
          else if (j.response) safePost(port, { chunk: j.response });
        } catch { /* partial */ }
      }
    }
    safePost(port, { done: true });
  } catch (e) {
    safePost(port, { error: e instanceof Error ? e.message : "Could not reach Lumen" });
  }
}

/* ---------------- messages ---------------- */

async function connected() {
  return Boolean((await getSettings()).token);
}

async function ensureItem(url: string, title: string, html: string, collectionId?: string) {
  const found = await cloudApi.lookup(url);
  if (found.item) return found.item;
  const s = await getSettings();
  const r = await cloudApi.save({ url, title, html, collectionId: collectionId ?? (s.targetCollectionId || undefined) });
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

    case "OPEN_PANEL": {
      if (!sender.tab && msg.tabId !== undefined) {
        const t = await chrome.tabs.get(msg.tabId);
        await openPanelFor(t, msg.prompt);
        return { ok: true };
      }
      const winId = sender.tab?.windowId;
      try {
        if (winId !== undefined) await chrome.sidePanel.open({ windowId: winId });
        if (msg.prompt) setTimeout(() => chrome.runtime.sendMessage({ type: "PANEL_PROMPT", prompt: msg.prompt }).catch(() => {}), 500);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }

    case "SET_HELPER_SITE":
      await setHelperSite(msg.host, msg.on);
      return { ok: true };

    case "SET_TOOLBAR_SITE": {
      const s = await getSettings();
      const list = msg.on ? s.toolbar.disabledSites.filter((x) => x !== msg.host) : [...new Set([...s.toolbar.disabledSites, msg.host])];
      await saveSettings({ toolbar: { ...s.toolbar, disabledSites: list } });
      return { ok: true };
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

    case "SAVE_PAGE_TO": {
      if (!(await connected())) return { ok: false, error: "Connect Lumen in settings to save pages." };
      const url = pageKey(msg.url);
      const found = await cloudApi.lookup(url);
      if (found.item) {
        const r = await cloud<{ item: unknown }>("PATCH", `/items/${found.item.id}`, { collectionId: msg.collectionId ?? null, ...(msg.tags?.length ? { tags: msg.tags } : {}) });
        return { ok: true, item: r.item, existed: true };
      }
      const r = await cloud<{ item: unknown }>("POST", "/items", { url, title: msg.title, html: msg.html, collectionId: msg.collectionId, tags: msg.tags });
      return { ok: true, item: r.item };
    }

    case "ADD_HIGHLIGHT": {
      const url = pageKey(msg.url);
      if (!(await connected())) {
        const now = Date.now();
        const h: Highlight = { ...msg.quote, id: "local_" + now.toString(36), itemId: "local", color: msg.color as Highlight["color"], note: msg.note ?? null, createdAt: now, updatedAt: now };
        await setLocalHighlights(url, [...(await localHighlights(url)), h]);
        return { ok: true, highlight: h, local: true };
      }
      const item = await ensureItem(url, msg.title, msg.html, msg.collectionId);
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

    case "GET_DESTINATIONS":
      return { ok: true, destinations: (await connected()) ? (await cloudApi.destinations()).data : [] };

    case "CREATE_COLLECTION": {
      let destinationId = msg.destinationId || undefined;
      if (msg.obsidianNote) {
        const d = await cloud<{ destination: { id: string } }>("POST", "/destinations", { kind: "obsidian", name: msg.obsidianNote.split("/").pop()?.replace(/\.md$/, "") || "Obsidian note", config: { notePath: msg.obsidianNote.endsWith(".md") ? msg.obsidianNote : `${msg.obsidianNote}.md`, format: "house" } });
        destinationId = d.destination.id;
      }
      const r = await cloud<{ collection: { id: string } }>("POST", "/collections", { name: msg.name, emoji: msg.emoji, color: "sun", destinationId });
      await saveSettings({ targetCollectionId: r.collection.id });
      buildMenus();
      return { ok: true, collection: r.collection };
    }

    case "SET_TARGET":
      await saveSettings({ targetCollectionId: msg.collectionId });
      return { ok: true };

    case "GET_SETTINGS":
      return { ok: true, settings: await getSettings() };

    case "SAVE_SETTINGS": {
      const settings = await saveSettings(msg.settings);
      if ("token" in msg.settings || "helper" in msg.settings) buildMenus();
      return { ok: true, settings };
    }

    case "TEST_CONNECTION":
      return testProvider(await getSettings());

    case "SYNC_TARGET":
      return { ok: true, ...(await syncTarget()) };

    case "GET_HOME": {
      if (!(await connected())) return { ok: false };
      const [stats, reads] = await Promise.all([
        cloud<{ streak: number; glowToday: number; dailyGoal: number; level: { name: string } }>("GET", "/stats").catch(() => null),
        cloud<{ picks: { id: string; title: string; readingMinutes: number; status: string; progress: number }[] }>("GET", "/reads?period=daily").catch(() => null),
      ]);
      return { ok: true, stats, picks: reads?.picks.slice(0, 4) ?? [] };
    }

    case "GET_RADAR": {
      if (!(await connected())) return { ok: false };
      try {
        const r = await cloud<{ trends: { id: string; title: string; url: string; topic: string; score: number; source: string }[] }>("GET", "/radar");
        return { ok: true, trends: r.trends.slice(0, 8) };
      } catch (e) {
        return { ok: false, pro: (e as { status?: number }).status === 402, error: e instanceof Error ? e.message : String(e) };
      }
    }

    case "SAVE_URL": {
      const r = await cloudApi.save({ url: msg.url, title: msg.title });
      return { ok: true, item: r.item, created: r.created };
    }

    case "FOLLOW_SITE": {
      const r = await cloud<{ feed: { id: string; title: string }; created: boolean }>("POST", "/following", { url: msg.url });
      return { ok: true, ...r };
    }

    case "UNFOLLOW_SITE":
      await cloud("DELETE", `/following/${msg.id}`);
      return { ok: true };

    case "GET_FOLLOW": {
      if (!(await connected())) return { ok: false };
      const r = await cloud<{ feed: { id: string; title: string } | null }>("GET", `/following/lookup?url=${encodeURIComponent(msg.url)}`).catch(() => ({ feed: null }));
      return { ok: true, feed: r.feed };
    }

    case "OPEN_OPTIONS":
      await chrome.runtime.openOptionsPage();
      return { ok: true };

    case "OPEN_DASHBOARD": {
      const s = await getSettings();
      await chrome.tabs.create({ url: `${s.apiBase}${msg.path ?? "/app"}` });
      return { ok: true };
    }
  }
}

/** New posts from followed blogs: one notification per post (up to 3), or one summary. */
async function checkNewPosts() {
  const s = await getSettings();
  if (!s.token) return;
  const r = await cloud<{ data: { id: string; url: string; title: string; feedTitle: string }[] }>("POST", "/following/notify", {});
  if (!r.data.length) return;
  const map: Record<string, { id: string; url: string }> = (await chrome.storage.local.get("lumen_post_urls")).lumen_post_urls ?? {};
  if (r.data.length > 3) {
    const nid = `lumen-post-summary-${Date.now()}`;
    map[nid] = { id: "", url: `${s.apiBase}/app/following` };
    chrome.notifications.create(nid, { type: "basic", iconUrl: "icons/icon128.png", title: `${r.data.length} new posts from blogs you follow`, message: r.data.slice(0, 3).map((p) => `${p.feedTitle}: ${p.title}`).join("\n"), priority: 0 });
  } else {
    for (const p of r.data) {
      const nid = `lumen-post-${p.id}`;
      map[nid] = { id: p.id, url: p.url };
      chrome.notifications.create(nid, { type: "basic", iconUrl: "icons/icon128.png", title: `New from ${p.feedTitle}`, message: p.title, priority: 0 });
    }
  }
  const keys = Object.keys(map); for (const k of keys.slice(0, Math.max(0, keys.length - 50))) delete map[k];
  await chrome.storage.local.set({ lumen_post_urls: map });
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
