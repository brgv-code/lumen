import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, MessageCircle, Sparkles, Highlighter, BookOpen, Library } from "lucide-react";
import { streamChat, type ChatSource } from "../../lib/api";
import { PageHero } from "../../components/PageHero";
import { Md } from "../../components/Md";
import { useNavigate } from "react-router-dom";

interface Msg { role: "user" | "assistant"; content: string; sources?: ChatSource[]; error?: string; streaming?: boolean }

const STARTERS = ["What have I been reading about lately?", "Which of my highlights disagree with each other?", "Summarise what I know about attention", "What should I write next, based on my notes?"];

export default function Ask() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const ask = async (question: string) => {
    if (!question.trim()) return;
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((l) => [...l, { role: "user", content: question }, { role: "assistant", content: "", streaming: true }]);
    setQ("");
    const patch = (fn: (m: Msg) => Msg) => setMsgs((l) => l.map((m, k) => (k === l.length - 1 ? fn(m) : m)));
    try {
      await streamChat({ question, history }, { text: (t) => patch((m) => ({ ...m, content: t })), sources: (s) => patch((m) => ({ ...m, sources: s })) });
      patch((m) => ({ ...m, streaming: false }));
    } catch (e) {
      patch((m) => ({ ...m, streaming: false, error: (e as Error).message }));
    }
  };

  return (
    <div className="page page--narrow">
      <PageHero pill={<><MessageCircle size={13} /> Ask</>} lead="Ask everything" pay="you have read."
        sub="Answers come from your own saved articles, highlights and notes, with numbered sources you can open."
        mesh="mesh-iris" tiles={[["tile--iris", <Sparkles />], ["tile--lamp", <Highlighter />], ["tile--mint", <BookOpen />], ["tile--sky", <Library />]]} />
      <section className="panel stack" style={{ gap: 14, minHeight: 360 }}>
        {msgs.length === 0 && (
          <div className="grid-2">
            {STARTERS.map((s) => <button key={s} className="item-card" style={{ border: 0, textAlign: "left", font: "inherit", cursor: "pointer" }} onClick={() => ask(s)}><span className="tile tile--sm tile--iris"><Sparkles /></span><span style={{ color: "var(--ink)", fontWeight: 500 }}>{s}</span></button>)}
          </div>
        )}
        {msgs.map((m, k) => m.role === "user" ? (
          <div key={k} style={{ justifySelf: "end", maxWidth: "80%", background: "var(--ink)", color: "var(--on-ink)", padding: "10px 14px", borderRadius: "16px 16px 4px 16px" }}>{m.content}</div>
        ) : (
          <div key={k} className="stack" style={{ gap: 8 }}>
            <div className="card-flat answer-md" style={{ padding: "12px 14px", lineHeight: 1.6, color: m.error ? "var(--peach)" : "var(--ink-2)" }}>
              {m.error ? m.error : <Md text={m.content} onCite={(n) => { const s = m.sources?.find((x) => x.n === n); if (s) nav(`/app/read/${s.itemId}${s.kind === "highlight" ? `#${s.id}` : ""}`); }} />}
              {m.streaming && <span className="caret" />}
            </div>
            {!m.streaming && m.sources && m.sources.length > 0 && /\[\d+\]/.test(m.content) && (
              <div className="grid-2" style={{ gap: 8 }}>
                {m.sources.map((s) => (
                  <Link key={s.n} to={`/app/read/${s.itemId}${s.kind === "highlight" ? `#${s.id}` : ""}`} className="card-flat row" style={{ padding: 10, alignItems: "flex-start" }}>
                    <span className="tile tile--xs tile--iris" style={{ fontSize: 11, fontWeight: 700 }}>{s.n}</span>
                    <span style={{ minWidth: 0 }}><b style={{ color: "var(--ink)", fontWeight: 500, fontSize: 13.5 }}>{s.title}</b>
                      {s.quote && <span className="small muted" style={{ display: "block", fontFamily: "var(--font-read)" }}>“{s.quote.slice(0, 110)}{s.quote.length > 110 ? "…" : ""}”</span>}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
        <form className="row" style={{ marginTop: "auto", position: "sticky", bottom: 8 }} onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <input className="input" style={{ height: 46, fontSize: 15 }} placeholder="Ask about anything you have saved…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="key key--iris" style={{ height: 46, width: 46, padding: 0 }} aria-label="Ask"><ArrowUp size={18} /></button>
        </form>
      </section>
    </div>
  );
}
