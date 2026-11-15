import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFromHtml } from "../src/worker/lib/extract.ts";

const article = (heading: string, sentence: string) =>
  `<article><h1>${heading}</h1>${`<p>${sentence.repeat(12)}</p>`.repeat(8)}</article>`;

// Next.js keeps the previous route in the DOM after a client navigation, hidden like this.
const pageWithHiddenPrevious = (hiddenStyle: string) => `<html><head><title>Structured outputs</title></head><body>
  <div style="${hiddenStyle}">${article("Task budgets", "Give Claude an advisory token budget for the whole task. ")}</div>
  <main>${article("Structured outputs", "Constrain the response to a JSON schema you provide. ")}</main>
</body></html>`;

for (const hiddenStyle of ["display: none", "display: none !important;", "DISPLAY:NONE!IMPORTANT"]) {
  test(`a previous page hidden with "${hiddenStyle}" is not taken as the article`, () => {
    const extracted = extractFromHtml(pageWithHiddenPrevious(hiddenStyle), "https://platform.claude.com/docs/en/build-with-claude/structured-outputs");
    assert.match(extracted.contentText ?? "", /JSON schema/);
    assert.doesNotMatch(extracted.contentText ?? "", /token budget/);
  });
}
