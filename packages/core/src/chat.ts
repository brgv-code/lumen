/** Updates one reply by id; a stream must never write into whatever turn happens to be last. */
export function patchReply<T extends { id?: string }>(turns: T[], replyId: string, update: (turn: T) => T): T[] {
  return turns.map((turn) => (turn.id === replyId ? update(turn) : turn));
}

/** Answers still streaming, one per key (a thread); each entry remembers which request owns it. */
export type LiveAnswers<T> = Record<string, T & { requestId: string }>;

/** A new request takes over its key, so any older request on that key stops counting. */
export function startLive<T>(live: LiveAnswers<T>, key: string, requestId: string, value: T): LiveAnswers<T> {
  return { ...live, [key]: { ...value, requestId } };
}

export function patchLive<T>(live: LiveAnswers<T>, key: string, requestId: string, update: (value: T) => T): LiveAnswers<T> {
  const current = live[key];
  if (current?.requestId !== requestId) return live;
  return { ...live, [key]: { ...update(current), requestId } };
}

export function endLive<T>(live: LiveAnswers<T>, key: string, requestId: string): LiveAnswers<T> {
  if (live[key]?.requestId !== requestId) return live;
  const { [key]: _ended, ...rest } = live;
  return rest;
}
