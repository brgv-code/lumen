import type { Highlight, HighlightAnswer, TextQuote } from "@lumen/core";

/** A highlight made while disconnected; `cloudId` is set once it reached the library, so a retry does not add it twice. */
export type LocalHighlight = Highlight & { cloudId?: string };

export interface LocalStore {
  all(): Promise<Record<string, LocalHighlight[]>>;
  set(url: string, list: LocalHighlight[]): Promise<void>;
}

export interface Uploader {
  itemFor(url: string): Promise<string>;
  addHighlight(itemId: string, highlight: TextQuote & { color: string; note: string | null }): Promise<string>;
  keepAnswer(highlightId: string, answer: Pick<HighlightAnswer, "parentId" | "action" | "question" | "answer" | "model">): Promise<string>;
}

/** Moves offline highlights and their kept answers into the library, saving progress after every step so a failure never repeats one. */
export async function uploadLocalHighlights(store: LocalStore, api: Uploader): Promise<void> {
  for (const [url, list] of Object.entries(await store.all())) {
    let left = list;
    let itemId: string | undefined;
    for (const original of list) {
      const persist = async (next: LocalHighlight | null) => {
        left = left.flatMap((h) => (h.id !== original.id ? [h] : next ? [next] : []));
        await store.set(url, left);
      };
      let h = original;
      if (!h.cloudId) {
        itemId ??= await api.itemFor(url);
        h = { ...h, cloudId: await api.addHighlight(itemId, { quote: h.quote, prefix: h.prefix, suffix: h.suffix, position: h.position, color: h.color, note: h.note }) };
        await persist(h);
      }
      while (h.answers?.length) {
        const [kept, ...rest] = h.answers;
        // A parent that never got a cloud id cannot be pointed at; the answer is kept on its own.
        const parentId = kept.parentId?.startsWith("local_") ? null : kept.parentId;
        const cloudId = await api.keepAnswer(h.cloudId!, { parentId, action: kept.action, question: kept.question, answer: kept.answer, model: kept.model });
        h = { ...h, answers: rest.map((a) => (a.parentId === kept.id ? { ...a, parentId: cloudId } : a)) };
        await persist(h);
      }
      await persist(null);
    }
  }
}
