/** Runs a task until it reports done: calls during a run share it, and a run that failed or was not done yet lets the next call try again. */
export function untilDone(task: () => Promise<boolean>): () => Promise<boolean> {
  let done = false;
  let running: Promise<boolean> | null = null;
  return () => {
    if (done) return Promise.resolve(true);
    running ??= task().then((finished) => { done = finished; return finished; }).finally(() => { running = null; });
    return running;
  };
}

/** Runs a task; asks that arrive while it runs share one more run after it, so the last ask always sees a fresh run. */
export function rerunIfAsked(task: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let askedAgain = false;
  const runUntilQuiet = async () => {
    do {
      askedAgain = false;
      await task();
    } while (askedAgain);
  };
  return () => {
    if (running) {
      askedAgain = true;
      return running;
    }
    running = runUntilQuiet().finally(() => { running = null; });
    return running;
  };
}
