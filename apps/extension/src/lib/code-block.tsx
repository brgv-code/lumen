import { useState } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import clang from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import scss from "highlight.js/lib/languages/scss";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

// Registering brings each grammar's aliases too: js, jsx, ts, tsx, html, sh, py, yml and so on.
for (const [name, grammar] of Object.entries({ bash, c: clang, cpp, csharp, css, diff, go, java, javascript, json, kotlin, markdown, php, python, ruby, rust, scss, sql, swift, typescript, xml, yaml })) {
  hljs.registerLanguage(name, grammar);
}

type CopyState = "idle" | "copied" | "failed";
const COPY_LABEL: Record<CopyState, string> = { idle: "Copy", copied: "Copied", failed: "Copy failed" };

/** A fenced code block: language label, copy button and syntax colours for languages we know. */
export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copy, setCopy] = useState<CopyState>("idle");
  // The fence info string can carry more than the language, as in ```ts title="a.ts".
  const language = (lang.trim().split(/\s+/)[0] ?? "").toLowerCase();
  const isKnown = language !== "" && hljs.getLanguage(language) !== undefined;

  const handleCopy = async () => {
    const state = await navigator.clipboard.writeText(code).then(() => "copied" as const, () => "failed" as const);
    setCopy(state);
    setTimeout(() => setCopy("idle"), 1500);
  };

  return (
    <div className="md-code">
      <div className="md-code__head">
        <span>{language || "text"}</span>
        <button type="button" className="md-code__copy" aria-label="Copy code" onClick={handleCopy}>{COPY_LABEL[copy]}</button>
      </div>
      {/* hljs escapes the source itself, so its output is safe to inject. */}
      <pre>{isKnown ? <code dangerouslySetInnerHTML={{ __html: hljs.highlight(code, { language, ignoreIllegals: true }).value }} /> : <code>{code}</code>}</pre>
    </div>
  );
}
