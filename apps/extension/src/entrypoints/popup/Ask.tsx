import { useRef, useState } from "react";

type Action = "summarize" | "explain" | "define" | "ask";

/** Ask about the page or the current selection, answered right in the popup. */
export function Ask({ tabId }: { tabId: number | undefined }) {
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState<"idle" | "streaming" | "error">("idle");
  const [q, setQ] = useState("");
  const [label, setLabel] = useState("");
  const portRef = useRef<chrome.runtime.Port | null>(null);

  const run = async (action: Action, question?: string) => {
    if (!tabId) return;
    const page = await chrome.tabs.sendMessage(tabId, { type: "GET_TEXT" }).catch(() => null) as { selection: string; text: string; title: string } | null;
    if (!page) { setState("error"); setAnswer("Reload the page once so Lumen can read it, then try again."); return; }
    const text = action === "summarize" && !page.selection ? page.text : page.selection || page.text.slice(0, 4000);
    if (!text.trim()) { setState("error"); setAnswer("There is no readable text on this page."); return; }
    setLabel(action === "ask" ? question! : `${action[0].toUpperCase()}${action.slice(1)} ${page.selection ? "the selection" : "this page"}`);
    setAnswer(""); setState("streaming");
    portRef.current?.disconnect();
    const port = chrome.runtime.connect({ name: "lumen-ai" });
    portRef.current = port;
    port.onMessage.addListener((m: { chunk?: string; done?: boolean; error?: string }) => {
      if (m.chunk) setAnswer((a) => a + m.chunk);
      if (m.done) setState("idle");
      if (m.error) { setState("error"); setAnswer(m.error); }
    });
    port.postMessage({ action, text, question, title: page.title });
  };

  return (
    <div className="surface stack" style={{ gap: 8, padding: 12 }}>
      <div className="row"><span className="tile iris sm">✦</span><b style={{ color: "var(--ink)" }}>Ask about this page</b></div>
      <div className="qchips">
        <button onClick={() => run("summarize")}>Summarize</button>
        <button onClick={() => run("explain")}>Explain selection</button>
        <button onClick={() => run("define")}>Define</button>
      </div>
      <form className="row" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); if (q.trim()) { run("ask", q.trim()); setQ(""); } }}>
        <input placeholder="What does this mean?" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="key" style={{ height: 38, flex: "none" }}>Ask</button>
      </form>
      {(answer || state === "streaming") && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="eyebrow" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
          <div className={`answer ${state === "streaming" ? "streaming" : ""}`} style={state === "error" ? { color: "var(--peach)" } : undefined}>{answer}</div>
          {state === "idle" && answer && <button className="key ghost" style={{ height: 30, justifySelf: "start" }} onClick={() => navigator.clipboard.writeText(answer)}>Copy answer</button>}
        </div>
      )}
      <div className="small muted">Select text on the page first to ask about just that part. Highlighting works from the page toolbar.</div>
    </div>
  );
}
