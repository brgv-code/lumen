import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";

/* ---------- brand ---------- */
export function AppIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ filter: "drop-shadow(0 6px 10px rgba(255,106,26,.35))" }}>
      <defs>
        <linearGradient id="li-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFB53D" /><stop offset="1" stopColor="#FF6A1A" /></linearGradient>
        <radialGradient id="li-s" cx=".5" cy=".15" r=".8"><stop offset="0" stopColor="#fff" stopOpacity=".5" /><stop offset=".6" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#li-g)" />
      <rect width="64" height="64" rx="16" fill="url(#li-s)" />
      <path d="M20 44h24" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <circle cx="32" cy="27" r="9" fill="#fff" />
      <path d="M32 10v3M47 27h-3M20 27h-3M42.6 16.4l-2.1 2.1M23.5 18.5l-2.1-2.1" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="row" style={{ gap: 9 }}>
      <AppIcon size={size} />
      <span style={{ fontWeight: 600, fontSize: size * 0.72, letterSpacing: "-0.04em", color: "var(--ink)" }}>lumen</span>
    </span>
  );
}

/* ---------- segmented control with sliding indicator ---------- */
export function Segmented<T extends string>({ options, value, onChange, size, label }: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm";
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>(`[data-v="${CSS.escape(value)}"]`);
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options.length]);
  return (
    <div ref={ref} className={`seg ${size === "sm" ? "seg--sm" : ""}`} role="tablist" aria-label={label}>
      {ind && <span className="seg__indicator" style={{ left: ind.left, width: ind.width }} />}
      {options.map((o) => (
        <button key={o.value} data-v={o.value} role="tab" aria-selected={o.value === value} className="seg__btn" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- toast ---------- */
type Toast = { id: number; text: ReactNode; tone: "ok" | "err" | "glow" };
const ToastCtx = createContext<(text: ReactNode, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: ReactNode, tone: Toast["tone"] = "ok") => {
    const id = Math.random();
    setList((l) => [...l.slice(-2), { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="toast-stack" role="status" aria-live="polite">
          {list.map((t) => (
            <div key={t.id} className="toast">
              <span className={`tile tile--xs ${t.tone === "err" ? "tile--peach" : t.tone === "glow" ? "tile--lamp" : "tile--mint"}`}>
                {t.tone === "err" ? <X /> : t.tone === "glow" ? <Sparkle /> : <Check />}
              </span>
              {t.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}

export function Sparkle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2c.4 4.6 2.4 7.6 7.5 8.6.6.1.6 1 0 1.1-5.1 1-7.1 4-7.5 8.6-.1.6-1 .6-1.1 0-.4-4.6-2.4-7.6-7.5-8.6-.6-.1-.6-1 0-1.1C8.5 9.6 10.5 6.6 10.9 2c.1-.6 1-.6 1.1 0Z" />
    </svg>
  );
}

/* ---------- modal ---------- */
export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title: string }) {
  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 20 }}>{title}</h3>
          <span className="spacer" />
          <button className="key key--quiet key--sm key--icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- confetti burst (lamplight sparks) ---------- */
export function burst(x: number, y: number) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#FFB53D", "#FF6A1A", "#8A7BFF", "#3FD39A", "#5B9BFF", "#FFD34D"];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement("span");
    const a = (Math.PI * 2 * i) / 26 + Math.random() * 0.3;
    const d = 60 + Math.random() * 90;
    s.style.cssText = `position:fixed;z-index:200;left:${x}px;top:${y}px;width:${6 + Math.random() * 5}px;height:${6 + Math.random() * 5}px;border-radius:${Math.random() > 0.5 ? "50%" : "2px"};background:${colors[i % colors.length]};pointer-events:none;transition:transform 900ms cubic-bezier(.2,.8,.2,1),opacity 900ms ease;`;
    document.body.appendChild(s);
    requestAnimationFrame(() => {
      s.style.transform = `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 40}px) rotate(${Math.random() * 360}deg)`;
      s.style.opacity = "0";
    });
    setTimeout(() => s.remove(), 950);
  }
}

export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="surface gridlines" style={{ padding: "56px 24px", textAlign: "center", display: "grid", justifyItems: "center", gap: 12 }}>
      <span className="tile tile--lg tile--ink bob" style={{ position: "relative" }}>{icon}</span>
      <h3 style={{ fontSize: 20, marginTop: 6, position: "relative" }}>{title}</h3>
      {children && <p className="muted" style={{ maxWidth: 380, position: "relative" }}>{children}</p>}
      {action && <div style={{ marginTop: 6, position: "relative" }}>{action}</div>}
    </div>
  );
}

export const COLOR_LABEL: Record<string, string> = { sun: "Sun", mint: "Mint", iris: "Iris", peach: "Peach", sky: "Sky" };
