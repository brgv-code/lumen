import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HIGHLIGHT_PALETTE, colorName, colorSwatch, hexToHsv, hsvToHex, normalizeColor } from "@lumen/core";

const RECENT_KEY = "lumen.customColors";

export function recentColors(): string[] {
  try { return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[]).filter((c) => normalizeColor(c)?.startsWith("#")).slice(0, 4); } catch { return []; }
}
/** Keep a custom colour in the recent row (palette names are always shown, so they are skipped). */
export function rememberColor(c: string) {
  if (!c.startsWith("#")) return;
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([c, ...recentColors().filter((x) => x !== c)].slice(0, 4))); } catch { /* private mode */ }
}
const LAST_KEY = "lumen.lastColor";
/** The colour last used to highlight, so Note and the default follow it. */
export function lastColor(): string { try { return normalizeColor(localStorage.getItem(LAST_KEY)) ?? "sun"; } catch { return "sun"; } }
export function setLastColor(c: string) { try { localStorage.setItem(LAST_KEY, c); } catch { /* private mode */ } }

/** The palette, recent custom colours, and a rainbow swatch that opens the colour wheel. */
export function ColorPicker({ value, onChange, size = 20, align = "left", inline = false }: { value?: string; onChange: (c: string) => void; size?: number; align?: "left" | "right"; inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(recentColors);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || inline) return;
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open, inline]);
  const custom = value?.startsWith("#") ? value : undefined;
  const chips = [...new Set([...(custom ? [custom] : []), ...recent])].slice(0, 4);
  const sw = (c: string, label: string) => (
    <button key={c} type="button" className="cp-sw" style={{ width: size, height: size, background: colorSwatch(c) }} aria-label={label} title={label} aria-pressed={value === c} onClick={() => onChange(c)} />
  );
  return (
    <div className="cp" ref={wrap}>
      {HIGHLIGHT_PALETTE.map((c) => sw(c.id, c.name))}
      {chips.map((c) => sw(c, `Custom ${c}`))}
      <button type="button" className="cp-sw cp-wheel-btn" style={{ width: size, height: size }} aria-label="Pick any colour" title="Pick any colour" aria-expanded={open} aria-pressed={!!custom && !chips.includes(custom)} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div className={inline ? "cp-inline" : `cp-pop cp-pop--${align}`} role="dialog" aria-label="Pick a colour">
          <ColorWheel initial={custom ?? "#ff7a59"} onPick={(c) => { rememberColor(c); setRecent(recentColors()); onChange(c); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

/** Hue and saturation on the wheel, brightness on the slider, or paste a hex code. */
export function ColorWheel({ initial, onPick }: { initial: string; onPick: (hex: string) => void }) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(initial));
  const hex = hsvToHex(...hsv);
  const [text, setText] = useState(hex);
  useEffect(() => { setText(hex); }, [hex]);
  const ring = useRef<HTMLDivElement>(null);
  const R = 76;
  const fromPointer = (e: React.PointerEvent) => {
    const r = ring.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const h = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    const s = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
    setHsv(([, , v]) => [h, s, v]);
  };
  const a = hsv[0] * Math.PI / 180;
  const tx = Math.sin(a) * hsv[1] * R, ty = -Math.cos(a) * hsv[1] * R;
  const typed = normalizeColor(text);
  return (
    <div className="cw">
      <div
        ref={ring}
        className="cw-ring"
        style={{ width: R * 2, height: R * 2, ["--v" as string]: String(1 - hsv[2]) }}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); fromPointer(e); }}
        onPointerMove={(e) => { if (e.buttons) fromPointer(e); }}
      >
        <span className="cw-thumb" style={{ transform: `translate(${tx}px, ${ty}px)`, background: hex }} />
      </div>
      <input className="cw-v" type="range" min={25} max={100} value={Math.round(hsv[2] * 100)} aria-label="Brightness"
        style={{ background: `linear-gradient(90deg, ${hsvToHex(hsv[0], hsv[1], 0.25)}, ${hsvToHex(hsv[0], hsv[1], 1)})` }}
        onChange={(e) => setHsv(([h, s]) => [h, s, Number(e.target.value) / 100])} />
      <div className="cw-row">
        <span className="cw-preview" style={{ background: typed?.startsWith("#") ? typed : hex }} />
        <input className="input cw-hex mono" value={text} spellCheck={false} aria-label="Hex code" placeholder="#ff7a59"
          onChange={(e) => { setText(e.target.value); const n = normalizeColor(e.target.value); if (n?.startsWith("#")) setHsv(hexToHsv(n)); }}
          onKeyDown={(e) => { if (e.key === "Enter" && typed) { e.preventDefault(); onPick(typed); } }} />
        <button type="button" className="key key--lamp key--sm" disabled={!typed} onClick={() => typed && onPick(typed)}>Use</button>
      </div>
      <p className="cw-hint">{typed ? `${colorName(typed)} · drag the wheel or paste a hex code` : "Paste a hex code like #ff7a59"}</p>
    </div>
  );
}

/** A single dot showing the current colour; opens the full picker. For tight rows like cards. */
export function ColorMenu({ value, onChange, align = "right" }: { value: string; onChange: (c: string) => void; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const [up, setUp] = useState(false);
  // open upwards when there is no room below
  useLayoutEffect(() => {
    if (!open || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    setUp(window.innerHeight - r.bottom < 460 && r.top > window.innerHeight - r.bottom);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="cp" ref={wrap}>
      <button type="button" className="cp-sw cp-current" style={{ width: 20, height: 20, background: colorSwatch(value) }} aria-label={`Colour: ${colorName(value)}. Change`} title={`${colorName(value)} · change colour`} aria-expanded={open} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div className={`cp-pop cp-pop--${align} cp-menu${up ? " cp-pop--up" : ""}`}>
          <ColorPicker value={value} size={24} inline onChange={(c) => { onChange(c); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}
