import { useState } from "react";
import { VISIBLE_PILLS, type Style } from "@lumen/core";

/** The active style chip and the pills that explain the passage again in another style (ADR-005). */
export function StylePills({ styles, active, isDefault, disabled, onPick, onClear, onNew }: {
  styles: Style[];
  active: Style | null;
  isDefault: boolean;
  disabled: boolean;
  onPick: (style: Style) => void;
  onClear: () => void;
  onNew: () => void;
}) {
  const [more, setMore] = useState(false);
  const pill = (style: Style) => (
    <button key={style.key} type="button" className={`chip ${active?.key === style.key ? "iris" : ""}`} aria-pressed={active?.key === style.key} disabled={disabled}
      onClick={() => { setMore(false); onPick(style); }} style={{ cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1 }}>
      {style.name}
    </button>
  );
  return (
    <div className="stack" style={{ gap: 6 }}>
      {active && (
        <div className="row small" style={{ gap: 6 }}>
          <span className="chip iris">✦ {active.name}{isDefault ? " · Default ✓" : ""}</span>
          <button type="button" className="icon-btn" title="Back to Standard for this chat" aria-label="Back to Standard for this chat" onClick={onClear}>✕</button>
        </div>
      )}
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {styles.slice(0, VISIBLE_PILLS).map(pill)}
        <button type="button" className="chip" aria-expanded={more} onClick={() => setMore(!more)} style={{ cursor: "pointer" }}>More ▾</button>
      </div>
      {more && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {styles.slice(VISIBLE_PILLS).map(pill)}
          <button type="button" className="chip" onClick={onNew} style={{ cursor: "pointer" }}>+ New style</button>
        </div>
      )}
    </div>
  );
}
