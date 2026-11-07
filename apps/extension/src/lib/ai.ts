// Margin answers from four providers. All stream chunks through onChunk.
import { LOCAL_TLDR_CHARS, READER_SYSTEM, TLDR_SYSTEM, paragraphsWithin, readerPrompt, tldrPrompt, type AIAction } from "@lumen/core";
import type { Settings } from "./types";

interface Req { action: AIAction; text: string; question?: string; title?: string; context?: string }
/** done gets the model that answered, for the card footer. */
type On = { chunk: (t: string) => void; done: (model?: string) => void; error: (e: string) => void };

export async function streamAnswer(req: Req, s: Settings, on: On, signal?: AbortSignal) {
  try {
    if (s.provider === "lumen") return await viaLumen("/ai/run", req, s, on, signal);
    const prompt = readerPrompt(req.action, req.text, { question: req.question, title: req.title, context: req.context });
    return await viaLocal(prompt, READER_SYSTEM, s, on, signal);
  } catch (e) {
    // A card that closed asked for this; nobody is left to show an error to.
    if (signal?.aborted) return;
    on.error(e instanceof Error ? e.message : String(e));
  }
}

/** TL;DR of a page: hosted Lumen reads it all (chunked server side); local models read the start. */
export async function streamTldr(req: { title: string; paragraphs: string[] }, s: Settings, on: On, signal?: AbortSignal) {
  try {
    if (s.provider === "lumen") return await viaLumen("/ai/tldr", req, s, on, signal);
    return await viaLocal(tldrPrompt(req.title, paragraphsWithin(req.paragraphs, LOCAL_TLDR_CHARS)), TLDR_SYSTEM, s, on, signal);
  } catch (e) {
    if (signal?.aborted) return;
    on.error(e instanceof Error ? e.message : String(e));
  }
}

function viaLocal(prompt: string, system: string, s: Settings, on: On, signal?: AbortSignal) {
  if (s.provider === "ollama") return viaOllama(prompt, system, s, on, signal);
  if (s.provider === "openai") return viaOpenAI(prompt, system, s, on, signal);
  return viaClaude(prompt, system, s, on, signal);
}

async function readSSE(res: Response, pick: (j: any) => string | undefined, on: On, model?: string) {
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
      if (d === "[DONE]") return on.done(model);
      try { const t = pick(JSON.parse(d)); if (t) on.chunk(t); } catch { /* partial */ }
    }
  }
  on.done(model);
}

async function viaLumen(path: string, req: object, s: Settings, on: On, signal?: AbortSignal) {
  if (!s.token) return on.error("Connect Lumen in settings, or switch the provider to Ollama or Claude.");
  const res = await fetch(`${s.apiBase}/api/v1${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${s.token}`, "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) { let m = `Lumen answered ${res.status}`; try { m = (await res.json()).error?.message ?? m; } catch { /* */ } return on.error(m); }
  await readSSE(res, (j) => j.response, on, res.headers.get("x-lumen-model") ?? undefined);
}

async function viaOllama(prompt: string, system: string, s: Settings, on: On, signal?: AbortSignal) {
  const res = await fetch(`${s.ollamaBaseUrl}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: s.model, system, prompt, stream: true }),
    signal,
  });
  if (res.status === 403) return on.error("Ollama blocked the extension. Restart it with OLLAMA_ORIGINS='chrome-extension://*' ollama serve");
  if (!res.ok) return on.error(`Ollama answered ${res.status}`);
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.trim()) continue;
      try { const j = JSON.parse(l); if (j.response) on.chunk(j.response); if (j.done) return on.done(s.model); } catch { /* */ }
    }
  }
  on.done(s.model);
}

async function viaOpenAI(prompt: string, system: string, s: Settings, on: On, signal?: AbortSignal) {
  const res = await fetch(`${s.openaiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${s.openaiKey}` },
    body: JSON.stringify({ model: s.model, stream: true, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
    signal,
  });
  if (!res.ok) return on.error(`API answered ${res.status}: ${(await res.text()).slice(0, 160)}`);
  await readSSE(res, (j) => j.choices?.[0]?.delta?.content, on, s.model);
}

const NO_PERMISSION = "Allow the Claude helper first: open Lumen settings and pick Claude (local CLI).";
/** Native messaging is an optional permission, granted when Claude is picked in settings. */
async function nativeAllowed(): Promise<boolean> {
  try { return await chrome.permissions.contains({ permissions: ["nativeMessaging"] }); } catch { return false; }
}

/** Claude through the local Lumen helper, which runs `claude -p` (native messaging). */
async function viaClaude(prompt: string, system: string, s: Settings, on: On, signal?: AbortSignal): Promise<void> {
  if (!(await nativeAllowed())) { on.error(NO_PERMISSION); return; }
  return new Promise((resolve) => {
    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connectNative("dev.lumen.host");
    } catch {
      on.error("The Lumen helper is not installed. Run apps/native-host/install.sh once.");
      return resolve();
    }
    let finished = false;
    port.onMessage.addListener((m: { chunk?: string; done?: boolean; error?: string }) => {
      if (m.chunk) on.chunk(m.chunk);
      if (m.error) { finished = true; on.error(m.error); port.disconnect(); resolve(); }
      if (m.done) { finished = true; on.done(`claude ${s.claudeModel}`); port.disconnect(); resolve(); }
    });
    port.onDisconnect.addListener(() => {
      if (!finished) on.error(chrome.runtime.lastError?.message?.includes("not found")
        ? "The Lumen helper is not installed. Run apps/native-host/install.sh once."
        : "The Lumen helper stopped. Is the claude CLI on your PATH?");
      resolve();
    });
    // Disconnecting ends the helper's claude run; finished stops the disconnect from reporting an error.
    signal?.addEventListener("abort", () => { finished = true; port.disconnect(); resolve(); }, { once: true });
    port.postMessage({ type: "claude", model: s.claudeModel, system, prompt });
  });
}

export async function testProvider(s: Settings): Promise<{ ok: boolean; message: string }> {
  try {
    if (s.provider === "lumen") {
      const r = await fetch(`${s.apiBase}/api/v1/me`, { headers: { authorization: `Bearer ${s.token}` } });
      return r.ok ? { ok: true, message: `Connected as ${(await r.json()).user.name}` } : { ok: false, message: `Lumen answered ${r.status}. Check the token.` };
    }
    if (s.provider === "ollama") {
      const r = await fetch(`${s.ollamaBaseUrl}/api/tags`);
      return r.ok ? { ok: true, message: "Ollama is reachable" } : { ok: false, message: r.status === 403 ? "Start Ollama with OLLAMA_ORIGINS='chrome-extension://*'" : `Ollama answered ${r.status}` };
    }
    if (s.provider === "openai") {
      const r = await fetch(`${s.openaiBaseUrl.replace(/\/$/, "")}/models`, { headers: { authorization: `Bearer ${s.openaiKey}` } });
      return r.ok ? { ok: true, message: "API key works" } : { ok: false, message: `API answered ${r.status}` };
    }
    if (!(await nativeAllowed())) return { ok: false, message: NO_PERMISSION };
    return await new Promise((resolve) => {
      try {
        const port = chrome.runtime.connectNative("dev.lumen.host");
        port.onMessage.addListener((m: { pong?: string; error?: string }) => { resolve(m.pong ? { ok: true, message: `Helper ready: ${m.pong}` } : { ok: false, message: m.error ?? "No answer" }); port.disconnect(); });
        port.onDisconnect.addListener(() => resolve({ ok: false, message: "Helper not installed. Run apps/native-host/install.sh" }));
        port.postMessage({ type: "ping" });
      } catch { resolve({ ok: false, message: "Helper not installed. Run apps/native-host/install.sh" }); }
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
  }
}
