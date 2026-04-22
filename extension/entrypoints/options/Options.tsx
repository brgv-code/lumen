import React, { useEffect, useState } from "react";
import type { Settings, AIProvider } from "../../lib/types";
import { DEFAULT_SETTINGS } from "../../lib/types";

type TestStatus = { ok: boolean; message: string } | null;

export default function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>(null);

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: "GET_SETTINGS" })
      .then((resp) => setSettings(resp.settings));
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleProviderChange(provider: AIProvider) {
    setSettings((prev) => ({
      ...prev,
      provider,
      model: provider === "ollama" ? "llama3.2" : "gpt-4o-mini",
    }));
  }

  async function handleSave() {
    await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleTest() {
    setTesting(true);
    setTestStatus(null);
    // Save current settings first so the background uses them
    await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
    const result = await chrome.runtime.sendMessage({ type: "TEST_CONNECTION" });
    setTestStatus(result);
    setTesting(false);
  }

  const isOllama = settings.provider === "ollama";

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-lumen-400 mb-1">Lumen Settings</h1>
        <p className="text-gray-500 text-sm mb-8">Configure your AI provider and preferences.</p>

        {/* Provider toggle */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            AI Provider
          </h2>
          <div className="flex gap-3">
            {(["ollama", "openai"] as AIProvider[]).map((p) => (
              <button
                key={p}
                onClick={() => handleProviderChange(p)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                  settings.provider === p
                    ? "bg-lumen-600 border-lumen-500 text-white"
                    : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                }`}
              >
                {p === "ollama" ? "Ollama (local)" : "OpenAI-compatible"}
              </button>
            ))}
          </div>
        </section>

        {/* API settings */}
        <section className="space-y-4 mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Connection
          </h2>

          <Field label="API Base URL">
            <input
              type="url"
              value={isOllama ? settings.ollamaBaseUrl : settings.openaiBaseUrl}
              onChange={(e) =>
                update(isOllama ? "ollamaBaseUrl" : "openaiBaseUrl", e.target.value)
              }
              className={inputClass}
              placeholder={isOllama ? "http://localhost:11434" : "https://api.openai.com/v1"}
            />
          </Field>

          {!isOllama && (
            <Field label="API Key">
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => update("apiKey", e.target.value)}
                className={inputClass}
                placeholder="sk-..."
                autoComplete="off"
              />
            </Field>
          )}

          <Field label="Model">
            <input
              type="text"
              value={settings.model}
              onChange={(e) => update("model", e.target.value)}
              className={inputClass}
              placeholder={isOllama ? "llama3.2" : "gpt-4o-mini"}
            />
          </Field>
        </section>

        {/* Test connection */}
        <section className="mb-8">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {testing ? "Testing…" : "Test connection"}
          </button>
          {testStatus && (
            <p
              className={`mt-2 text-sm ${testStatus.ok ? "text-green-400" : "text-red-400"}`}
            >
              {testStatus.ok ? "✓" : "✗"} {testStatus.message}
            </p>
          )}
        </section>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full py-2.5 bg-lumen-600 hover:bg-lumen-500 text-white font-medium rounded-lg transition-colors"
        >
          {saved ? "Saved!" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-lumen-500 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
