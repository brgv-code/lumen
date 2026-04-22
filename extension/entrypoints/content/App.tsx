import React, { useEffect, useState, useCallback, useRef } from "react";

import type { ActionType } from "../../lib/types";
import SelectionTooltip from "./SelectionTooltip";
import ResultPanel from "./ResultPanel";

interface SelectionState {
  text: string;
  rect: DOMRect;
}

interface StreamState {
  content: string;
  done: boolean;
  error: string | null;
  action: ActionType | null;
  selectedText: string;
  pageTitle: string;
  pageUrl: string;
}

function isContextInvalidated(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.message.includes("Extension context invalidated")
  );
}

async function sendMsg(msg: object): Promise<unknown> {
  try {
    return await chrome.runtime.sendMessage(msg);
  } catch (err) {
    if (isContextInvalidated(err)) {
      throw new Error(
        "Lumen was updated — please refresh this page to continue using it.",
      );
    }
    throw err;
  }
}

export default function App() {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [stream, setStream] = useState<StreamState | null>(null);
  const streamRef = useRef<StreamState | null>(null);

  // Listen for stream messages from background
  useEffect(() => {
    const handler = (message: {
      type: string;
      chunk?: string;
      done?: boolean;
      error?: string;
    }) => {
      if (message.type === "AI_STREAM_CHUNK") {
        setStream((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            content: prev.content + (message.chunk ?? ""),
            done: message.done ?? false,
          };
          streamRef.current = updated;
          return updated;
        });
      } else if (message.type === "AI_STREAM_ERROR") {
        setStream((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            error: message.error ?? "Unknown error",
            done: true,
          };
        });
      }
    };
    try {
      chrome.runtime.onMessage.addListener(handler);
    } catch {
      // Context already invalidated on mount — nothing to do
    }
    return () => {
      try {
        chrome.runtime.onMessage.removeListener(handler);
      } catch {
        // Already gone
      }
    };
  }, []);

  // Selection detection
  useEffect(() => {
    const onMouseUp = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (text && text.length > 1) {
          const range = sel!.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelection({ text, rect });
        } else {
          setSelection(null);
        }
      }, 10);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelection(null);
        setStream(null);
      }
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const handleAction = useCallback(
    async (action: ActionType) => {
      if (!selection) return;
      const initialStream: StreamState = {
        content: "",
        done: false,
        error: null,
        action,
        selectedText: selection.text,
        pageTitle: document.title,
        pageUrl: window.location.href,
      };
      setStream(initialStream);
      setSelection(null);
      try {
        await sendMsg({ type: "AI_REQUEST", text: selection.text, action });
      } catch (err) {
        setStream(
          (prev) =>
            prev && { ...prev, error: (err as Error).message, done: true },
        );
      }
    },
    [selection],
  );

  const handleBookmark = useCallback(async () => {
    if (!selection) return;
    const favicon =
      document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href ?? "";
    try {
      await sendMsg({
        type: "SAVE_ITEM",
        item: {
          type: "bookmark",
          pageTitle: document.title,
          pageUrl: window.location.href,
          favicon,
          timestamp: Date.now(),
        },
      });
    } catch (err) {
      if (isContextInvalidated(err)) {
        console.warn("[Lumen]", (err as Error).message);
      }
    }
    setSelection(null);
  }, [selection]);

  const handleDismissTooltip = useCallback(() => setSelection(null), []);
  const handleDismissResult = useCallback(() => setStream(null), []);

  const handleSave = useCallback(async () => {
    if (!stream) return;
    try {
      await sendMsg({
        type: "SAVE_ITEM",
        item: {
          type: "ai",
          selectedText: stream.selectedText,
          result: stream.content,
          action: stream.action!,
          pageTitle: stream.pageTitle,
          pageUrl: stream.pageUrl,
          timestamp: Date.now(),
        },
      });
    } catch (err) {
      if (isContextInvalidated(err)) {
        setStream(
          (prev) =>
            prev && { ...prev, error: (err as Error).message, done: true },
        );
      }
    }
  }, [stream]);

  return (
    <>
      {selection && (
        <SelectionTooltip
          rect={selection.rect}
          onAction={handleAction}
          onBookmark={handleBookmark}
          onDismiss={handleDismissTooltip}
        />
      )}
      {stream && (
        <ResultPanel
          content={stream.content}
          done={stream.done}
          error={stream.error}
          onSave={handleSave}
          onDismiss={handleDismissResult}
        />
      )}
    </>
  );
}
