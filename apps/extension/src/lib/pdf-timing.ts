// Timing for the slow PDF open, from the browser's request to the viewer being usable. Off in store builds.
declare const __LUMEN_PDF_TIMING__: boolean;

export const PDF_TIMING = __LUMEN_PDF_TIMING__;

export interface Span { step: string; where: "network" | "background" | "viewer"; start: number; end: number; detail?: string }

interface LongFrame extends PerformanceEntry {
  blockingDuration: number;
  scripts: { invoker: string; sourceURL: string; sourceFunctionName: string; duration: number }[];
}

/** Wall clock ms with sub ms precision, so the background's and the viewer's times share one axis. */
export function now(): number {
  return performance.timeOrigin + performance.now();
}

export class Timeline {
  readonly spans: Span[] = [];

  constructor(private where: Span["where"]) {}

  /** Awaits `work` whether timing is on or not, so call sites read the same either way. */
  async time<T>(step: string, work: Promise<T>, describe?: (value: T) => string): Promise<T> {
    if (!PDF_TIMING) return work;
    const start = now();
    try {
      const value = await work;
      this.add(step, start, now(), describe?.(value));
      return value;
    } catch (error) {
      this.add(step, start, now(), "failed");
      throw error;
    }
  }

  add(step: string, start: number, end = now(), detail?: string, where = this.where) {
    if (!PDF_TIMING) return;
    this.spans.push({ step, where, start, end, detail });
    console.log(`[lumen:pdf] ${where} · ${step} · ${Math.round(end - start)} ms`, detail ?? "");
    // Shows up in the DevTools Performance panel's Timings track.
    if (start >= performance.timeOrigin) performance.measure(`lumen: ${step}`, { start: start - performance.timeOrigin, end: end - performance.timeOrigin });
  }
}

/** The viewer page's own loading: the document and every script, stylesheet and worker it fetched. */
export function pageLoadSpans(): Span[] {
  const origin = performance.timeOrigin;
  const page = performance.getEntriesByType("navigation").find((entry) => entry instanceof PerformanceNavigationTiming);
  const files = performance.getEntriesByType("resource").filter((entry) => entry instanceof PerformanceResourceTiming);
  return [
    ...(page ? [{ step: "load pdf.html", where: "viewer" as const, start: origin, end: origin + page.responseEnd }] : []),
    ...files.map((file) => ({
      step: `load ${file.name.split("/").pop()?.split("?")[0]}`,
      where: "viewer" as const,
      start: origin + file.startTime,
      end: origin + file.responseEnd,
      detail: `${Math.round(file.decodedBodySize / 1024)} kB, ${file.initiatorType}`,
    })),
  ];
}

/** Frames where the main thread was busy for 50 ms or more, with the script that kept it busy. */
export function watchLongFrames(): LongFrame[] {
  const frames: LongFrame[] = [];
  if (!PDF_TIMING || !PerformanceObserver.supportedEntryTypes.includes("long-animation-frame")) return frames;
  new PerformanceObserver((list) => frames.push(...list.getEntries().filter(isLongFrame))).observe({ type: "long-animation-frame", buffered: true });
  return frames;
}

function isLongFrame(entry: PerformanceEntry): entry is LongFrame {
  return "scripts" in entry;
}

export function printTimeline(spans: Span[], frames: LongFrame[]) {
  if (!PDF_TIMING || !spans.length) return;
  const zero = Math.min(...spans.map((span) => span.start));
  const last = Math.max(...spans.map((span) => span.end));
  const at = (time: number) => Math.round(time - zero);
  console.group(`[lumen:pdf] ${at(last)} ms from the browser's request to the last step`);
  console.table([...spans].sort((first, second) => first.start - second.start).map((span) => ({
    step: span.step, where: span.where, starts: at(span.start), ends: at(span.end), took: Math.round(span.end - span.start), detail: span.detail ?? "",
  })));
  if (frames.length) {
    console.log("[lumen:pdf] main thread busy for 50 ms or more:");
    console.table([...frames].sort((first, second) => second.duration - first.duration).slice(0, 10).map((frame) => {
      const [script] = [...frame.scripts].sort((first, second) => second.duration - first.duration);
      return {
        starts: at(performance.timeOrigin + frame.startTime),
        took: Math.round(frame.duration),
        blocking: Math.round(frame.blockingDuration),
        script: script ? `${script.invoker} ${script.sourceFunctionName || ""} @ ${script.sourceURL.split("/").pop()}`.trim() : "(rendering or style)",
      };
    }));
  }
  console.groupEnd();
}
