import React, { useEffect, useRef } from "react";

interface Props {
  content: string;
  done: boolean;
  error: string | null;
  onSave: () => void;
  onDismiss: () => void;
}

export default function ResultPanel({ content, done, error, onSave, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll as content streams in
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [onDismiss]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 2147483647,
        width: "380px",
        maxWidth: "calc(100vw - 48px)",
      }}
      ref={ref}
      className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <span className="text-xs font-semibold text-lumen-400 uppercase tracking-wider">
          Lumen
        </span>
        <button
          onClick={onDismiss}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          <XIcon />
        </button>
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className="px-4 py-3 max-h-72 overflow-y-auto text-sm text-gray-200 leading-relaxed whitespace-pre-wrap"
      >
        {error ? (
          <span className="text-red-400">{error}</span>
        ) : content ? (
          <>
            {content}
            {!done && <span className="animate-pulse ml-0.5 text-lumen-400">▋</span>}
          </>
        ) : (
          <span className="text-gray-500 animate-pulse">Thinking…</span>
        )}
      </div>

      {/* Actions */}
      {(done || error) && (
        <div className="flex gap-2 px-4 py-3 border-t border-gray-700">
          {!error && (
            <button
              onClick={onSave}
              className="flex-1 py-1.5 text-xs font-medium bg-lumen-600 hover:bg-lumen-500 text-white rounded-lg transition-colors"
            >
              Save
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex-1 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Copy
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
