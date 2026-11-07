import { Fragment, type ReactNode } from "react";
import { Marked, type MarkedToken, type Token, type Tokens } from "marked";
import { CodeBlock } from "./code-block";

interface Handlers { onCite?: (n: number) => void; onParagraph?: (n: number) => void }

// Models write single newlines as line breaks, so keep them.
const parser = new Marked({ gfm: true, breaks: true });
const HEADINGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'" };

/** Safe GFM for answers, built as React elements so raw HTML never runs, plus [n] and [p12] citations. */
export function Md({ text, onCite, onParagraph }: { text: string } & Handlers) {
  // "•" bullets were lists before marked; keep them that way.
  const source = text.replace(/^(\s*)•\s+/gm, "$1- ");
  return <>{blocks(parser.lexer(source), { onCite, onParagraph })}</>;
}

function blocks(tokens: Token[], handlers: Handlers): ReactNode[] {
  return tokens.map((token, key) => {
    // No marked extensions are registered, so every token is a built in one.
    const node = token as MarkedToken;
    switch (node.type) {
      case "paragraph": return <p key={key} className="md-p">{inlines(node.tokens, handlers)}</p>;
      case "heading": { const Heading = HEADINGS[node.depth - 1] ?? "h6"; return <Heading key={key} className="md-h">{inlines(node.tokens, handlers)}</Heading>; }
      case "code": return <CodeBlock key={key} code={node.text} lang={node.lang ?? ""} />;
      case "blockquote": return <blockquote key={key} className="md-quote">{blocks(node.tokens, handlers)}</blockquote>;
      case "list": return list(node, key, handlers);
      case "table": return table(node, key, handlers);
      case "hr": return <hr key={key} className="md-hr" />;
      case "html": return <p key={key} className="md-p">{node.text}</p>;
      case "text": return <Fragment key={key}>{"tokens" in node && node.tokens ? inlines(node.tokens, handlers) : cite(decode(node.text), handlers)}</Fragment>;
      default: return null;
    }
  });
}

function list(node: Tokens.List, key: number, handlers: Handlers) {
  const items = node.items.map((item, index) => (
    <li key={index} className={item.task ? "md-task" : undefined}>
      {item.task && <input type="checkbox" checked={item.checked ?? false} disabled />}
      {blocks(item.tokens, handlers)}
    </li>
  ));
  if (!node.ordered) return <ul key={key} className="md-list">{items}</ul>;
  return <ol key={key} className="md-list" start={node.start === "" ? undefined : node.start}>{items}</ol>;
}

function table(node: Tokens.Table, key: number, handlers: Handlers) {
  return (
    <div key={key} className="md-table">
      <table>
        <thead><tr>{node.header.map((cell, index) => <th key={index} style={{ textAlign: cell.align ?? undefined }}>{inlines(cell.tokens, handlers)}</th>)}</tr></thead>
        <tbody>
          {node.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, index) => <td key={index} style={{ textAlign: cell.align ?? undefined }}>{inlines(cell.tokens, handlers)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function inlines(tokens: Token[], handlers: Handlers): ReactNode[] {
  return tokens.map((token, key) => {
    const node = token as MarkedToken;
    switch (node.type) {
      case "text": return <Fragment key={key}>{"tokens" in node && node.tokens ? inlines(node.tokens, handlers) : cite(decode(node.text), handlers)}</Fragment>;
      case "escape": return decode(node.text);
      case "strong": return <b key={key}>{inlines(node.tokens, handlers)}</b>;
      case "em": return <em key={key}>{inlines(node.tokens, handlers)}</em>;
      case "del": return <del key={key}>{inlines(node.tokens, handlers)}</del>;
      case "codespan": return <code key={key}>{decode(node.text)}</code>;
      case "br": return <br key={key} />;
      case "link": return link(node.href, inlines(node.tokens, handlers), key);
      case "image": return link(node.href, decode(node.text) || node.href, key);
      // Models put <br> in table cells; any other tag shows as the text it is.
      case "html": return /^<br\s*\/?>$/i.test(node.text) ? <br key={key} /> : node.text;
      default: return null;
    }
  });
}

function link(href: string, label: ReactNode, key: number) {
  if (!/^(https?:|mailto:)/i.test(href)) return <Fragment key={key}>{label}</Fragment>;
  return <a key={key} className="md-link" href={href} target="_blank" rel="noreferrer">{label}</a>;
}

function cite(text: string, { onCite, onParagraph }: Handlers): ReactNode[] {
  return text.split(/(\[p?\d+\])/).map((part, key) => {
    const match = /^\[(p?)(\d+)\]$/.exec(part);
    if (!match) return part;
    const target = Number(match[2]);
    if (match[1]) return <button key={key} className="cite" onClick={() => onParagraph?.(target)}>¶{target}</button>;
    return <button key={key} className="cite" onClick={() => onCite?.(target)}>{target}</button>;
  });
}

// marked 14 escapes text for HTML output and React escapes again, so undo the first pass.
const decode = (text: string) => text.replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity);
