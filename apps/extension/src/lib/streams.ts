/** Answer streams the background is running, per tab and request, so a closed card can stop its own. */
export class OpenStreams {
  private open = new Map<string, AbortController>();

  start(tabId: number, requestId: number): { signal: AbortSignal; finish: () => void } {
    const key = `${tabId}:${requestId}`;
    const controller = new AbortController();
    this.open.set(key, controller);
    // Only forget this stream's own entry; a newer request may reuse the key after a reload.
    return { signal: controller.signal, finish: () => { if (this.open.get(key) === controller) this.open.delete(key); } };
  }

  cancel(tabId: number, requestId: number) {
    const key = `${tabId}:${requestId}`;
    this.open.get(key)?.abort();
    this.open.delete(key);
  }

  get size() { return this.open.size; }
}
