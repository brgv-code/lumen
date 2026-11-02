import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookCheck, Check, RotateCcw } from "lucide-react";
import type { RecallCard } from "@lumen/core";
import { PageHero } from "../../components/PageHero";
import { Empty, useToast } from "../../components/ui";
import { useAsync } from "../../lib/hooks";
import { api } from "../../lib/api";
import { hlStyle } from "../../lib/hl";
import { useApp } from "./Layout";

function whenNext(at: number | null) {
  if (!at) return null;
  return new Date(at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export default function Recall() {
  const [params] = useSearchParams();
  const itemId = params.get("item") ?? undefined;
  const { refresh } = useApp();
  const session = useAsync(() => api.recall(itemId), [itemId]);
  const [index, setIndex] = useState(0);
  const [remembered, setRemembered] = useState(0);

  const cards = session.data?.data ?? [];
  const card = cards[index];
  const finished = session.data && index >= cards.length;

  const advance = (grade: "again" | "good") => {
    if (grade === "good") setRemembered((count) => count + 1);
    setIndex((at) => at + 1);
    refresh();
  };

  return (
    <div className="page page--narrow">
      <PageHero
        pill={<><BookCheck size={13} /> Recall</>}
        lead="Say it back."
        pay="That is how it stays."
        sub={session.data ? (itemId ? `${cards.length} questions on “${cards[0]?.itemTitle ?? "this article"}”` : `${session.data.due} due now · ${session.data.total} in total`) : " "}
      />

      {session.loading && <div className="skeleton" style={{ height: 280 }} />}

      {session.data && session.data.total === 0 && (
        <section className="panel">
          <Empty icon={<BookCheck />} title="Nothing to recall yet" action={<Link to="/app/library" className="key key--sm">Open your library</Link>}>
            Finish an article you highlighted and Lumen asks two or three questions about it. You answer in your own words, then see the passage again. Remembered answers come back later, a little further apart each time.
          </Empty>
        </section>
      )}

      {card && (
        <>
          <div className="recall-progress" aria-label={`Question ${index + 1} of ${cards.length}`}>
            {cards.map((each, at) => <span key={each.id} className={at < index ? "done" : at === index ? "on" : ""} />)}
          </div>
          <RecallStep key={card.id} card={card} onGraded={advance} />
        </>
      )}

      {finished && session.data!.total > 0 && (
        <section className="panel recall-done">
          <span className="tile tile--mint"><Check /></span>
          <h2>{cards.length ? `${remembered} of ${cards.length} remembered` : "All caught up"}</h2>
          <p className="muted">{whenNext(session.data!.nextDueAt) ? `Next questions on ${whenNext(session.data!.nextDueAt)}.` : "New questions arrive when you finish an article you highlighted."}</p>
          <Link to="/app/library" className="key key--ghost key--sm">Back to your library <ArrowRight size={14} /></Link>
        </section>
      )}
    </div>
  );
}

function RecallStep({ card, onGraded }: { card: RecallCard; onGraded: (grade: "again" | "good") => void }) {
  const toast = useToast();
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  const grade = async (choice: "again" | "good") => {
    setBusy(true);
    try {
      await api.reviewRecall(card.id, choice, answer.trim() || undefined);
      onGraded(choice);
    } catch (e) {
      toast((e as Error).message, "err");
      setBusy(false);
    }
  };

  return (
    <section className="panel recall-card pop">
      <span className="eyebrow">{card.itemTitle}</span>
      <h2 className="recall-question">{card.question}</h2>
      {!revealed ? (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); setRevealed(true); }}>
          <textarea className="textarea" autoFocus rows={4} placeholder="In your own words…" value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Your answer" />
          <div className="row">
            <button type="button" className="key key--quiet key--sm" onClick={() => setRevealed(true)}>I don't remember</button>
            <span className="spacer" />
            <button className="key key--sm" disabled={!answer.trim()}>Check</button>
          </div>
        </form>
      ) : (
        <div className="stack">
          {answer.trim() && (
            <div className="recall-mine">
              <span className="eyebrow">You wrote</span>
              <p>{answer.trim()}</p>
            </div>
          )}
          {card.quote && (
            <div className="recall-source">
              <span className="eyebrow">The passage you kept</span>
              <blockquote><mark className="hl" style={hlStyle("sun")}>{card.quote}</mark></blockquote>
              <Link className="small muted" to={`/app/read/${card.itemId}${card.highlightId ? `#${card.highlightId}` : ""}`}>Open in the reader</Link>
            </div>
          )}
          {card.answer && card.reviews > 0 && card.answer !== answer.trim() && (
            <div className="recall-mine recall-mine--past">
              <span className="eyebrow">Last time you wrote</span>
              <p>{card.answer}</p>
            </div>
          )}
          <div className="row">
            <button className="key key--ghost key--sm" disabled={busy} onClick={() => grade("again")}><RotateCcw size={14} /> Not yet</button>
            <span className="spacer" />
            <button className="key key--sm" disabled={busy} onClick={() => grade("good")}><Check size={14} /> I had it</button>
          </div>
        </div>
      )}
    </section>
  );
}
