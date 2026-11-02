import { useEffect, useRef, useState } from "react";
import { setConsent, shouldAsk } from "../lib/analytics";
import { AppIcon, burst } from "./ui";

const LAMP_LINES = [
  "Pages and buttons only. Never what you read.",
  "Still just clicks. Pinky promise.",
  "We never read over your shoulder.",
  "Okay, that lamp is not a button. Mostly.",
];

/** Lumen's analytics ask: short, a little playful, both answers one click. */
export function ConsentBanner() {
  const [ask, setAsk] = useState(false);
  const [line, setLine] = useState(0);
  const [done, setDone] = useState<"" | "yes" | "no">("");
  const [wiggle, setWiggle] = useState(0);
  const yes = useRef<HTMLButtonElement>(null);
  useEffect(() => { shouldAsk().then(setAsk); }, []);
  if (!ask) return null;

  const pick = (v: "yes" | "no") => {
    if (v === "yes" && yes.current) { const r = yes.current.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2); }
    setDone(v);
    void setConsent(v);
    setTimeout(() => setAsk(false), 1400);
  };

  return (
    <div className={`consent card${done ? " consent--out" : ""}`} role="dialog" aria-label="Analytics">
      <button className="consent__lamp" key={wiggle} aria-label="Lumen" onClick={() => { setLine((l) => (l + 1) % LAMP_LINES.length); setWiggle((w) => w + 1); }}>
        <AppIcon size={38} />
      </button>
      {done ? (
        <p className="consent__title">{done === "yes" ? "Lamp's on. Thank you!" : "Lights off. No hard feelings."}</p>
      ) : (
        <div className="consent__body">
          <p className="consent__title">Can we <span className="consent__mark">highlight</span> your clicks?</p>
          <p className="consent__line small muted" aria-live="polite">{LAMP_LINES[line]} <a href="/privacy">Details</a></p>
          <div className="consent__actions">
            <button className="key key--ghost key--sm" onClick={() => pick("no")}>Nah, lights off</button>
            <button ref={yes} className="key key--lamp key--sm" onClick={() => pick("yes")}>Highlight away</button>
          </div>
        </div>
      )}
    </div>
  );
}
