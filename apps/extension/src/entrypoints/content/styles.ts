// Inside the shadow root: the Lumen design tokens, scoped so pages cannot touch them.
export const UI_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
[hidden] { display: none !important; }
button { font: inherit; cursor: pointer; border: 0; }
@keyframes pop { 0% { transform: scale(.9); opacity: 0 } 60% { transform: scale(1.03); opacity: 1 } 100% { transform: scale(1) } }
@keyframes blink { 50% { opacity: .2 } }

.bar {
  position: absolute; display: flex; align-items: center; gap: 1px; padding: 4px;
  background: rgba(18,18,21,.96); color: #fff; border-radius: 12px; white-space: nowrap;
  box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 16px 30px -12px rgba(0,0,0,.55);
  animation: pop 220ms cubic-bezier(.34,1.56,.64,1) both; backdrop-filter: blur(8px);
}
.bar .act { position: relative; display: inline-flex; align-items: center; gap: 6px; height: 30px; min-width: 30px; justify-content: center; padding: 0 7px;
  background: transparent; color: rgba(255,255,255,.82); border-radius: 8px; font-size: 12.5px; font-weight: 500; }
.bar .act:hover { background: rgba(255,255,255,.12); color: #fff; }
.bar .act svg { flex: none; }
.bar:not(.labels) .act span { display: none; }
.bar .act[data-color="sun"] svg { color: #ffd34d; }
.bar .more { color: rgba(255,255,255,.5); }
.hl-group { position: relative; display: inline-flex; }
.flyout { position: absolute; left: 50%; bottom: calc(100% + 6px); transform: translateX(-50%) scale(.9); opacity: 0; pointer-events: none;
  display: flex; gap: 6px; padding: 6px 8px; border-radius: 99px; background: rgba(18,18,21,.96); box-shadow: 0 10px 20px -10px rgba(0,0,0,.6);
  transition: opacity 140ms ease, transform 160ms cubic-bezier(.34,1.56,.64,1); }
.hl-group:hover .flyout { opacity: 1; transform: translateX(-50%) scale(1); pointer-events: auto; }
.flyout::after { content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 8px; }
.flyout .sw { width: 18px; height: 18px; padding: 0; border-radius: 50%; box-shadow: inset 0 0 0 2px rgba(255,255,255,.25); transition: transform 140ms cubic-bezier(.34,1.56,.64,1); }
.flyout .sw:hover { transform: scale(1.2); }
.sep { width: 1px; height: 16px; background: rgba(255,255,255,.14); margin: 0 3px; }

/* the page helper */
:host(.has-helper) .card { bottom: 84px; }
:host(.has-helper.helper-left) .card { bottom: 18px; }
.helper { position: fixed; bottom: 22px; z-index: 2147483646; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.helper.right { right: 18px; } .helper.left { left: 18px; align-items: flex-start; }
.orb { position: relative; width: 46px; height: 46px; padding: 0; border-radius: 15px; background: none; filter: drop-shadow(0 10px 18px rgba(255,106,26,.45));
  animation: bob 6s ease-in-out infinite; transition: transform 180ms cubic-bezier(.34,1.56,.64,1); }
.orb:hover { transform: scale(1.08) rotate(-4deg); }
.orb .badge { position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 99px; background: #121215; color: #fff; font-size: 11px; font-weight: 700; display: grid; place-items: center; box-shadow: 0 0 0 2px #fff; }
.hname { font-size: 11px; font-weight: 600; color: #3a3a3f; background: rgba(255,255,255,.9); padding: 2px 8px; border-radius: 99px; opacity: 0; transform: translateY(-4px); transition: all 160ms ease; box-shadow: 0 4px 10px -6px rgba(0,0,0,.3); }
.helper:hover .hname { opacity: 1; transform: none; }
.hmenu { width: 250px; background: #f6f6f5; border-radius: 18px; padding: 8px; box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 30px 60px -20px rgba(0,0,0,.4); animation: pop 260ms cubic-bezier(.34,1.56,.64,1) both; }
.hhead { padding: 8px 10px 10px; display: grid; gap: 2px; }
.hhead b { color: #0e0e10; font-size: 14px; } .hhead .muted { font-size: 12px; color: #8c8c92; }
.hmenu button, .menu button { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px; background: transparent; color: #3a3a3f; font-size: 13.5px; font-weight: 500; text-align: left; }
.hmenu button:hover, .menu button:hover { background: #fff; color: #0e0e10; }
.hmenu button svg, .menu button svg { color: #ff8a1f; flex: none; }
.hsep { height: 1px; background: rgba(14,14,16,.08); margin: 4px 8px; }
.menu { display: grid; gap: 2px; }
@keyframes bob { 0%, 100% { translate: 0 0; } 50% { translate: 0 -4px; } }

.card {
  position: fixed; right: 18px; bottom: 18px; width: 340px; max-height: 70vh; overflow: auto;
  background: #f6f6f5; color: #3a3a3f; border-radius: 20px; padding: 14px;
  box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 30px 60px -20px rgba(0,0,0,.35);
  font-size: 14px; line-height: 1.5; animation: pop 320ms cubic-bezier(.34,1.56,.64,1) both;
}
.head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.head b { color: #0e0e10; font-weight: 600; font-size: 14.5px; }
.sp { flex: 1; }
.tile { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: #fff; font-size: 13px;
  background: linear-gradient(180deg,#ffb53d,#ff6a1a); box-shadow: 0 8px 14px -6px rgba(255,106,26,.6), inset 0 1px 0 rgba(255,255,255,.3); }
.tile.iris { background: linear-gradient(180deg,#8a7bff,#5b48f5); box-shadow: 0 8px 14px -6px rgba(91,72,245,.6), inset 0 1px 0 rgba(255,255,255,.3); }
.x { background: transparent; color: #8c8c92; width: 26px; height: 26px; border-radius: 8px; }
.x:hover { background: #e3e3e1; color: #0e0e10; }
.chip { font-size: 11.5px; padding: 2px 8px; border-radius: 99px; background: #fff; color: #3a3a3f; box-shadow: inset 0 0 0 1px rgba(14,14,16,.1); }
.q { margin: 0 0 10px; padding: 10px 12px; border-radius: 12px; background: #fff; color: #0e0e10;
  font-family: "Newsreader", Georgia, serif; font-size: 15px; line-height: 1.55; max-height: 120px; overflow: auto; }
.q.lumen-sun { background: #fff6d1; } .q.lumen-mint { background: #e4f8ee; } .q.lumen-iris { background: #efecff; }
.q.lumen-peach { background: #ffeee7; } .q.lumen-sky { background: #e7f0ff; }
.note { background: #fff; border-radius: 10px; padding: 8px 10px; margin-bottom: 10px; font-size: 13.5px; }
.answer { background: #fff; border-radius: 12px; padding: 12px; white-space: pre-wrap; min-height: 44px; font-size: 14px; color: #3a3a3f; }
.answer.streaming::after { content: ""; display: inline-block; width: 7px; height: 14px; margin-left: 2px; vertical-align: -2px; border-radius: 2px; background: #6d5bff; animation: blink 900ms infinite; }
.answer.err { color: #c2410c; }
.row { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.row .sw { width: 22px; height: 22px; border-radius: 50%; }
.row .sw.on { box-shadow: 0 0 0 2px #f6f6f5, 0 0 0 4px #0e0e10; }
.key { height: 32px; padding: 0 12px; border-radius: 9px; font-size: 13px; font-weight: 500; color: #fff;
  background: linear-gradient(180deg,#2b2b30,#0e0e10);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.2), inset 0 -2px 0 rgba(0,0,0,.2), 0 10px 18px -10px rgba(0,0,0,.6); }
.key:active { transform: translateY(1px); }
.key.ghost { background: #fff; color: #0e0e10; box-shadow: inset 0 -1px 0 rgba(14,14,16,.12), 0 1px 2px rgba(0,0,0,.06); }
.key.iris { background: linear-gradient(180deg,#8a7bff,#5b48f5); }
.key.danger { color: #d93a3f; }
textarea, input { width: 100%; border: 0; border-radius: 10px; padding: 10px 12px; font-size: 14px; color: #0e0e10; background: #fff;
  box-shadow: inset 0 0 0 1px rgba(14,14,16,.12); outline: none; }
textarea { min-height: 80px; resize: vertical; }
textarea:focus, input:focus { box-shadow: inset 0 0 0 1.5px #ff8a1f, 0 0 0 4px rgba(255,138,31,.16); }
.hint { font-size: 12px; color: #8c8c92; }
.toast { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); padding: 10px 16px; border-radius: 14px;
  background: #121215; color: #fff; font-size: 13.5px; font-weight: 500; box-shadow: 0 18px 34px -12px rgba(0,0,0,.5);
  animation: pop 300ms cubic-bezier(.34,1.56,.64,1) both; }
.toast.err { background: #b42318; }
@media (prefers-color-scheme: dark) {
  .hmenu { background: #18181b; } .hhead b { color: #f4f4f5; }
  .hmenu button, .menu button { color: #c9c9ce; } .hmenu button:hover, .menu button:hover { background: #232327; color: #fff; }
  .hsep { background: rgba(255,255,255,.08); } .hname { background: rgba(34,34,38,.92); color: #e4e4e7; }
  .card { background: #18181b; color: #c9c9ce; box-shadow: 0 1px 0 rgba(255,255,255,.05) inset, 0 30px 60px -20px rgba(0,0,0,.8); }
  .head b, .q, textarea, input { color: #f4f4f5; }
  .q, .note, .answer, textarea, input, .key.ghost, .chip { background: #222226; }
  .q.lumen-sun { background: rgba(255,213,74,.22); } .q.lumen-mint { background: rgba(46,204,142,.2); } .q.lumen-iris { background: rgba(140,125,255,.24); }
  .q.lumen-peach { background: rgba(255,130,100,.22); } .q.lumen-sky { background: rgba(80,150,255,.22); }
  .answer { color: #c9c9ce; } .chip { color: #c9c9ce; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }
  .key.ghost { color: #f4f4f5; box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); }
  .x:hover { background: #2a2a2f; color: #fff; }
  textarea, input { box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }
  .row .sw.on { box-shadow: 0 0 0 2px #18181b, 0 0 0 4px #f4f4f5; }
}
`;

// In the page itself: only the marks, nothing else.
export const MARK_CSS = `
mark.lumen-mark { color: inherit !important; border-radius: 3px; padding: 0 1px; cursor: pointer;
  -webkit-box-decoration-break: clone; box-decoration-break: clone; transition: filter 150ms ease; }
mark.lumen-mark:hover { filter: saturate(1.5) brightness(.97); }
mark.lumen-sun { background: #ffe58a !important; } mark.lumen-mint { background: #bdefd5 !important; }
mark.lumen-iris { background: #dcd6ff !important; } mark.lumen-peach { background: #ffd5c6 !important; }
mark.lumen-sky { background: #cfe2ff !important; }
`;
