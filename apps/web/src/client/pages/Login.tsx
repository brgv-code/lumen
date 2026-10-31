import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Github, Sparkles } from "lucide-react";
import { AppIcon, useToast } from "../components/ui";
import { api } from "../lib/api";

const ERRORS: Record<string, string> = {
  google_not_configured: "Google sign in is not configured on this deployment yet.",
  github_not_configured: "GitHub sign in is not configured on this deployment yet.",
  state_mismatch: "That sign in link expired. Try again.",
  exchange_failed: "The provider did not confirm your sign in. Try again.",
  dev_login: "That test login link is not valid.",
};

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function Login() {
  const [p, setP] = useState<{ google: boolean; github: boolean; demo: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const err = params.get("error");

  useEffect(() => {
    api.providers().then(setP).catch(() => setP({ google: false, github: false, demo: true }));
    api.me().then(() => nav("/app", { replace: true })).catch(() => {});
  }, [nav]);

  const demo = async () => {
    setBusy(true);
    try { await api.demo(); nav("/app"); } catch (e) { toast((e as Error).message, "err"); setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <Link to="/" className="key key--quiet key--sm" style={{ position: "fixed", top: 16, left: 16 }}><ArrowLeft size={15} /> Home</Link>
      <div className="surface gridlines pop" style={{ width: "min(440px, 100%)", padding: "40px 32px 32px", display: "grid", gap: 14, textAlign: "center" }}>
        <div style={{ justifySelf: "center", position: "relative" }} className="bob"><AppIcon size={64} /></div>
        <h1 className="h3" style={{ position: "relative", marginTop: 8 }}><span className="lead-in">Welcome to</span> <span className="payoff">Lumen.</span></h1>
        <p className="muted" style={{ position: "relative", marginBottom: 10 }}>One account for the dashboard and the extension.</p>
        {err && <div className="chip chip--peach" style={{ justifySelf: "center", height: "auto", padding: "6px 12px", whiteSpace: "normal", position: "relative" }}>{ERRORS[err] ?? "Sign in failed."}</div>}

        <a
          className="key key--ghost key--lg"
          href={p?.google ? "/auth/google/start?next=/app" : undefined}
          aria-disabled={!p?.google}
          onClick={(e) => { if (!p?.google) { e.preventDefault(); toast("Google SSO needs GOOGLE_CLIENT_ID and SECRET on this deployment.", "err"); } }}
          style={{ position: "relative", opacity: p && !p.google ? 0.6 : 1 }}
        >
          <GoogleMark /> Continue with Google
        </a>
        <a
          className="key key--lg"
          href={p?.github ? "/auth/github/start?next=/app" : undefined}
          aria-disabled={!p?.github}
          onClick={(e) => { if (!p?.github) { e.preventDefault(); toast("GitHub SSO needs GITHUB_CLIENT_ID and SECRET on this deployment.", "err"); } }}
          style={{ position: "relative", opacity: p && !p.github ? 0.6 : 1 }}
        >
          <Github size={17} /> Continue with GitHub
        </a>

        {p?.demo !== false && (
          <>
            <div className="row small muted" style={{ position: "relative", margin: "6px 0" }}>
              <span style={{ flex: 1, height: 1, background: "var(--hairline-strong)" }} />or<span style={{ flex: 1, height: 1, background: "var(--hairline-strong)" }} />
            </div>
            <button className="key key--lamp key--lg" onClick={demo} disabled={busy} style={{ position: "relative" }}>
              <Sparkles size={16} /> {busy ? "Lighting the lamp…" : "Explore the demo sandbox"}
            </button>
            <p className="small muted" style={{ position: "relative" }}>A private sandbox with sample reading. Deleted after 3 days.</p>
          </>
        )}
        {p && !p.google && !p.github && (
          <p className="small muted" style={{ position: "relative", marginTop: 6 }}>SSO providers are not configured on this preview yet.</p>
        )}
      </div>
    </div>
  );
}
