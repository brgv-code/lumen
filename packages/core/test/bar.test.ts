import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { createSelectionBar, placeBar, stepIndex, type BarChoice, type BarConfig } from "../src/bar.ts";
import { DEFAULT_BAR_ACTIONS } from "../src/toolbar.ts";
import { coveringQuote } from "../src/dom.ts";
import { quoteFromText } from "../src/text.ts";

const VIEWPORT = { width: 1000, height: 800 };
const SIZE = { width: 200, height: 38 };
const line = (left: number, top: number, width: number, height = 20) => ({ left, top, width, height, bottom: top + height });

test("placeBar sits centred above the first line", () => {
  assert.deepEqual(placeBar([line(300, 400, 100), line(100, 420, 500)], SIZE, VIEWPORT), { left: 250, top: 354 });
});

test("placeBar drops below the last line near the top edge", () => {
  assert.deepEqual(placeBar([line(300, 20, 100), line(100, 40, 500)], SIZE, VIEWPORT), { left: 250, top: 68 });
});

test("placeBar keeps the bar inside the viewport and ignores empty line boxes", () => {
  assert.deepEqual(placeBar([line(0, 0, 0, 0), line(980, 400, 10)], SIZE, VIEWPORT), { left: 792, top: 354 });
  assert.equal(placeBar([line(10, 10, 0, 20)], SIZE, VIEWPORT), null);
});

test("stepIndex wraps arrows and jumps with Home and End", () => {
  assert.equal(stepIndex(4, "ArrowRight", 5, "ArrowRight", "ArrowLeft"), 0);
  assert.equal(stepIndex(0, "ArrowLeft", 5, "ArrowRight", "ArrowLeft"), 4);
  assert.equal(stepIndex(-1, "ArrowRight", 5, "ArrowRight", "ArrowLeft"), 0);
  assert.equal(stepIndex(2, "End", 5, "ArrowDown", "ArrowUp"), 4);
  assert.equal(stepIndex(2, "Home", 5, "ArrowDown", "ArrowUp"), 0);
  assert.equal(stepIndex(2, "a", 5, "ArrowRight", "ArrowLeft"), null);
});

function setup(config: Partial<BarConfig> = {}) {
  const { document, window } = parseHTML("<!doctype html><html><body><article><p>The lamp was on.</p></article></body></html>");
  const scope = document.querySelector("article");
  if (!scope) throw new Error("fixture has no article");
  const choices: BarChoice[] = [];
  const bar = createSelectionBar({
    scope,
    config: () => ({ actions: DEFAULT_BAR_ACTIONS, labels: false, color: "sun", colors: ["sun", "mint"], extras: [{ id: "panel", label: "Open the Lumen panel", icon: "panel" }], ...config }),
    onChoose: (choice) => choices.push(choice),
  });
  const range = Object.assign(document.createRange(), { getClientRects: () => [line(100, 300, 80)] });
  const shadow = bar.host.shadowRoot;
  if (!shadow) throw new Error("bar has no shadow root");
  const find = (selector: string) => {
    const found = shadow.querySelector<HTMLElement>(selector);
    if (!found) throw new Error(`nothing matches ${selector}`);
    return found;
  };
  const press = (target: HTMLElement, key: string) => target.dispatchEvent(Object.assign(new window.Event("keydown", { bubbles: true }), { key }));
  const click = (target: HTMLElement) => target.dispatchEvent(new window.Event("click", { bubbles: true }));
  bar.show({ quote: { quote: "lamp", prefix: "The ", suffix: " was", position: 4 }, range });
  return { bar, document, choices, find, press, click };
}

test("the bar renders the default actions in order, then More", () => {
  const { find, bar } = setup();
  const acts = Array.from(find(".bar").querySelectorAll<HTMLElement>(".rove")).map((element) => element.dataset.act ?? element.dataset.color ?? "more");
  assert.deepEqual(acts, ["sun", "note", "explain", "simplify", "copy", "more"]);
  assert.equal(bar.isOpen(), true);
});

test("More lists what is not on the bar, then the host extras", () => {
  const { find } = setup();
  const items = Array.from(find(".menu").querySelectorAll<HTMLElement>(".item")).map((element) => element.dataset.act ?? element.dataset.extra);
  assert.deepEqual(items, ["ask", "define", "counterpoint", "related", "expand", "save", "cite", "panel"]);
});

test("choosing reports the choice with the snapshot and closes the bar", () => {
  const { find, click, choices, bar } = setup();
  click(find('[data-act="simplify"]'));
  assert.deepEqual(choices, [{ kind: "action", action: "simplify" }]);
  assert.equal(bar.isOpen(), false);
});

test("swatches, any colour and extras report their own kinds", () => {
  const first = setup();
  first.click(first.find('.sw[data-color="mint"]'));
  const second = setup();
  second.click(second.find(".sw.wheel"));
  const third = setup();
  third.click(third.find('[data-extra="panel"]'));
  assert.deepEqual([...first.choices, ...second.choices, ...third.choices], [{ kind: "highlight", color: "mint" }, { kind: "any-colour" }, { kind: "extra", id: "panel" }]);
});

test("More toggles its menu and Escape closes the menu before the bar", () => {
  const { find, click, press, bar } = setup();
  const more = find("[data-more]");
  click(more);
  assert.equal(find(".menu").hidden, false);
  assert.equal(more.getAttribute("aria-expanded"), "true");
  press(find('.item[data-act="define"]'), "Escape");
  assert.equal(find(".menu").hidden, true);
  assert.equal(bar.isOpen(), true);
  press(more, "Escape");
  assert.equal(bar.isOpen(), false);
});

test("keys pressed inside the bar never reach the page", () => {
  const { find, press, document } = setup();
  let reached = 0;
  document.addEventListener("keydown", () => reached++);
  press(find('[data-act="note"]'), "k");
  assert.equal(reached, 0);
});

test("labels show words next to the icons", () => {
  const { find } = setup({ labels: true });
  assert.equal(find('[data-act="simplify"] span').textContent, "Simplify");
});

test("destroy removes the host", () => {
  const { bar, document } = setup();
  bar.destroy();
  assert.equal(document.querySelector("lumen-bar"), null);
});

test("coveringQuote finds the highlight that overlaps a passage", () => {
  const { document } = parseHTML("<!doctype html><html><body><p>The lamp was on. The lamp was off.</p></body></html>");
  const text = "The lamp was on. The lamp was off.";
  const marked = { ...quoteFromText(text, 17, 33), id: "second" };
  const elsewhere = { ...quoteFromText(text, 0, 8), id: "first" };
  assert.equal(coveringQuote(document.body, quoteFromText(text, 21, 25), [elsewhere, marked])?.id, "second");
  assert.equal(coveringQuote(document.body, quoteFromText(text, 9, 15), [elsewhere, marked]), undefined);
});
