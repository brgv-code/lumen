import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="surface gridlines" style={{ padding: "48px 28px", textAlign: "center", display: "grid", justifyItems: "center", gap: 14, maxWidth: 560 }}>
        <span className="tile tile--xl tile--lamp bob" style={{ position: "relative" }}><BookOpen /></span>
        <h1 className="h3" style={{ position: "relative" }}><span className="lead-in">This page wandered off.</span> <span className="payoff">The lamp is still on.</span></h1>
        <div className="row" style={{ position: "relative", flexWrap: "wrap", justifyContent: "center" }}>
          <Link className="key key--lamp" to="/">Home</Link><a className="key key--ghost" href="/answers">Answers</a><a className="key key--ghost" href="/docs">Docs</a>
        </div>
      </div>
    </div>
  );
}
