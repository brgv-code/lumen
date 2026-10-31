import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { setConsent, shouldAsk } from "../lib/analytics";

/** A small, honest ask. No dark patterns: both buttons are equal. */
export function ConsentBanner() {
  const [ask, setAsk] = useState(false);
  useEffect(() => { shouldAsk().then(setAsk); }, []);
  if (!ask) return null;
  const pick = (v: "yes" | "no") => { setAsk(false); void setConsent(v); };
  return (
    <div className="consent surface pop" role="dialog" aria-label="Analytics">
      <p className="small">Help make Lumen better? With your OK we use <b>PostHog</b> (EU) to see which pages and buttons people use, with your reading and typing hidden. No ads. <Link to="/privacy" reloadDocument>Privacy</Link></p>
      <div className="row" style={{ gap: 8 }}>
        <button className="key key--ghost key--sm" onClick={() => pick("no")}>No thanks</button>
        <button className="key key--ghost key--sm" onClick={() => pick("yes")}>Allow</button>
      </div>
    </div>
  );
}
