// The "any colour" picker inside the page card: hue and saturation on a wheel, brightness on a
// slider, or a pasted hex code. Plain DOM, since it lives in the content script's shadow root.
import { hexToHsv, hsvToHex, normalizeColor } from "@lumen/core";

export const WHEEL_CSS = `
.cw { display: grid; gap: 12px; justify-items: center; padding: 4px 0 2px; }
.cw-ring { position: relative; width: 168px; height: 168px; border-radius: 50%; cursor: crosshair; touch-action: none;
  background: radial-gradient(circle closest-side, #fff, rgba(255,255,255,0)), conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); }
.cw-ring::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: #000; opacity: var(--v, 0); pointer-events: none; }
.cw-thumb { position: absolute; left: calc(50% - 9px); top: calc(50% - 9px); width: 18px; height: 18px; border-radius: 99px; z-index: 1; pointer-events: none; box-shadow: 0 0 0 3px #fff, 0 2px 8px rgba(0,0,0,.35); }
.cw-v { width: 100%; height: 12px; border-radius: 99px; -webkit-appearance: none; appearance: none; outline: none; margin: 0; }
.cw-v::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 99px; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.35); cursor: pointer; }
.cw-row { display: flex; gap: 8px; align-items: center; width: 100%; margin: 0; }
.cw-preview { width: 32px; height: 32px; border-radius: 10px; flex: none; box-shadow: inset 0 0 0 1px rgba(0,0,0,.1); }
.cw-hex { flex: 1; min-width: 0; height: 32px; border-radius: 9px; border: 0; padding: 0 10px; background: #fff; color: #0e0e10;
  font: 500 13px ui-monospace, "Geist Mono", monospace; box-shadow: inset 0 0 0 1px rgba(14,14,16,.12); outline: none; }
.cw-hex:focus { box-shadow: inset 0 0 0 2px #ff8a1f; }
:host(.dark) .cw-hex { background: #232327; color: #f4f4f5; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }
.sw.wheel { background: conic-gradient(#ff4d4d, #ffd34d, #3fd39a, #2cc6d4, #5b9bff, #bb7bff, #ff6fa5, #ff4d4d) !important; position: relative; }
.sw.wheel::after { content: ""; position: absolute; inset: 28%; border-radius: 99px; background: #121215; }
.row .sw.wheel::after, .card .sw.wheel::after { background: #f6f6f5; }
:host(.dark) .card .sw.wheel::after { background: #18181b; }
`;

export function wheelHTML(): string {
  return `<div class="cw">
    <div class="cw-ring"><span class="cw-thumb"></span></div>
    <input class="cw-v" type="range" min="25" max="100" aria-label="Brightness">
    <div class="cw-row"><span class="cw-preview"></span><input class="cw-hex" spellcheck="false" aria-label="Hex code" placeholder="#ff7a59"><button class="key" data-act="use-color">Use</button></div>
  </div>`;
}

/** Wire the wheel inside `root`. Returns a getter for the chosen colour (null while the hex box is invalid). */
export function bindWheel(root: HTMLElement, initial: string, onPick: (hex: string) => void): () => string | null {
  const ring = root.querySelector<HTMLElement>(".cw-ring")!;
  const thumb = root.querySelector<HTMLElement>(".cw-thumb")!;
  const slider = root.querySelector<HTMLInputElement>(".cw-v")!;
  const hexIn = root.querySelector<HTMLInputElement>(".cw-hex")!;
  const preview = root.querySelector<HTMLElement>(".cw-preview")!;
  let hsv = hexToHsv(normalizeColor(initial)?.startsWith("#") ? initial : "#ff7a59");
  let chosen: string | null = hsvToHex(...hsv);
  const R = 84;
  const draw = (fromText = false) => {
    const hex = hsvToHex(...hsv);
    const a = (hsv[0] * Math.PI) / 180;
    thumb.style.transform = `translate(${Math.sin(a) * hsv[1] * R}px, ${-Math.cos(a) * hsv[1] * R}px)`;
    thumb.style.background = hex;
    ring.style.setProperty("--v", String(1 - hsv[2]));
    slider.value = String(Math.round(hsv[2] * 100));
    slider.style.background = `linear-gradient(90deg, ${hsvToHex(hsv[0], hsv[1], 0.25)}, ${hsvToHex(hsv[0], hsv[1], 1)})`;
    if (!fromText) { hexIn.value = hex; chosen = hex; }
    preview.style.background = chosen ?? hex;
  };
  const at = (e: PointerEvent) => {
    const r = ring.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    hsv = [((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360, Math.min(1, Math.hypot(dx, dy) / (r.width / 2)), hsv[2]];
    draw();
  };
  ring.addEventListener("pointerdown", (e) => { ring.setPointerCapture(e.pointerId); at(e); });
  ring.addEventListener("pointermove", (e) => { if (e.buttons) at(e); });
  slider.addEventListener("input", () => { hsv = [hsv[0], hsv[1], Number(slider.value) / 100]; draw(); });
  hexIn.addEventListener("input", () => {
    const n = normalizeColor(hexIn.value);
    chosen = n;
    if (n?.startsWith("#")) { hsv = hexToHsv(n); draw(true); } else preview.style.background = n ? "" : "transparent";
  });
  // page shortcuts must not see what is typed here
  hexIn.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && chosen) onPick(chosen); });
  hexIn.addEventListener("keyup", (e) => e.stopPropagation());
  draw();
  return () => chosen;
}
