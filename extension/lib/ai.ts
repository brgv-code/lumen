import type { ActionType, Settings } from "./types";

function buildPrompt(text: string, action: ActionType): string {
  switch (action) {
    case "explain":
      return `Explain the following text clearly and concisely:\n\n"${text}"`;
    case "summarize":
      return `Summarize the following text in a few sentences:\n\n"${text}"`;
    case "define":
      return `Define the key term or concept in the following text:\n\n"${text}"`;
  }
}

export async function streamAIResponse(
  text: string,
  action: ActionType,
  settings: Settings,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
): Promise<void> {
  const prompt = buildPrompt(text, action);

  try {
    if (settings.provider === "ollama") {
      await streamOllama(prompt, settings, onChunk, onDone, onError);
    } else {
      await streamOpenAI(prompt, settings, onChunk, onDone, onError);
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : "Unknown error");
  }
}

async function streamOllama(
  prompt: string,
  settings: Settings,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
): Promise<void> {
  const response = await fetch(`${settings.ollamaBaseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.model,
      prompt,
      stream: true,
    }),
  });

  if (!response.ok) {
    if (response.status === 403) {
      onError(
        "Ollama blocked the request (403). Chrome extensions are not in Ollama's default allowed origins.\n\nFix: restart Ollama with:\n  OLLAMA_ORIGINS='chrome-extension://*' ollama serve\n\nOr set that env var in your system/launchd config.",
      );
    } else {
      onError(`Ollama error: ${response.status} ${response.statusText}`);
    }
    return;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value, { stream: true }).split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.response) onChunk(data.response);
        if (data.done) {
          onDone();
          return;
        }
      } catch {}
    }
  }
  onDone();
}

async function streamOpenAI(
  prompt: string,
  settings: Settings,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
): Promise<void> {
  const response = await fetch(`${settings.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    onError(`API error: ${response.status} - ${body}`);
    return;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    const lines = text.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        onDone();
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onChunk(content);
      } catch {
        // skip
      }
    }
  }
  onDone();
}

export async function testConnection(
  settings: Settings,
): Promise<{ ok: boolean; message: string }> {
  try {
    if (settings.provider === "ollama") {
      const resp = await fetch(`${settings.ollamaBaseUrl}/api/tags`, {
        method: "GET",
      });
      if (resp.ok)
        return { ok: true, message: "Connected to Ollama successfully" };
      if (resp.status === 403) {
        return {
          ok: false,
          message:
            "403 — restart Ollama with: OLLAMA_ORIGINS='chrome-extension://*' ollama serve",
        };
      }
      return { ok: false, message: `Ollama returned ${resp.status}` };
    } else {
      const resp = await fetch(`${settings.openaiBaseUrl}/models`, {
        headers: { Authorization: `Bearer ${settings.apiKey}` },
      });
      if (resp.ok)
        return { ok: true, message: "Connected to OpenAI API successfully" };
      return { ok: false, message: `API returned ${resp.status}` };
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Connection failed",
    };
  }
}
