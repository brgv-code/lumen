import type { Citation, ItemTldr } from "@lumen/core";
import { toTldr } from "./map";

/** Citations as the client resolved them; anything malformed is dropped. */
export function cleanCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): Citation[] => {
    const quote = entry?.quote;
    if (typeof entry?.n !== "number" || typeof quote?.quote !== "string") return [];
    return [{
      n: Math.floor(entry.n),
      quote: { quote: quote.quote.slice(0, 5000), prefix: String(quote.prefix ?? "").slice(0, 64), suffix: String(quote.suffix ?? "").slice(0, 64), position: Math.max(0, Number(quote.position) || 0) },
    }];
  }).slice(0, 30);
}

export async function tldrFor(db: D1Database, itemId: string): Promise<ItemTldr | null> {
  const row = await db.prepare("SELECT * FROM item_tldrs WHERE item_id = ?").bind(itemId).first();
  return row ? toTldr(row) : null;
}
