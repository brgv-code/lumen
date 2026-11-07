// Google Docs draws text on a canvas, so the page has nothing to extract; its markdown export does.

// "/document/u/1/d/<id>" is a second signed in account; "/document/d/e/<id>/pub" is a published copy with no export.
const DOC_PATH = /^\/document\/(u\/\d+\/)?d\/([A-Za-z0-9_-]{20,})(?:\/|$)/;

function docPath(url: string): { account: string; id: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "docs.google.com") return null;
    const match = DOC_PATH.exec(parsed.pathname);
    return match?.[2] ? { account: match[1] ?? "", id: match[2] } : null;
  } catch {
    return null;
  }
}

export function googleDocId(url: string): string | null {
  return docPath(url)?.id ?? null;
}

/** One address per doc, whatever tab, account or view the link was shared with. */
export function googleDocUrl(url: string): string | null {
  const doc = docPath(url);
  return doc ? `https://docs.google.com/document/d/${doc.id}/edit` : null;
}

/** Keeps the account segment, so the browser's cookies open a private doc. */
export function googleDocExportUrl(url: string): string | null {
  const doc = docPath(url);
  return doc ? `https://docs.google.com/document/${doc.account}d/${doc.id}/export?format=md` : null;
}

/** The doc's name, from the export's download header; the markdown itself has no title. */
export function googleDocTitle(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition)?.[1];
  const plain = /filename="([^"]+)"/i.exec(contentDisposition)?.[1];
  const name = encoded ? decodeURIComponent(encoded) : plain;
  return name?.replace(/\.md$/i, "").trim() || null;
}
