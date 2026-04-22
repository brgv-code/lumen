import React, { useEffect, useRef } from "react";
import type { ActionType } from "../../lib/types";

interface Props {
  rect: DOMRect;
  onAction: (action: ActionType) => void;
  onBookmark: () => void;
  onDismiss: () => void;
}

const ACTIONS: { label: string; value: ActionType }[] = [
  { label: "Explain", value: "explain" },
  { label: "Summarize", value: "summarize" },
  { label: "Define", value: "define" },
];

export default function SelectionTooltip({ rect, onAction, onBookmark, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Shadow host is position:fixed at (0,0), so use viewport coords directly
  const top = Math.max(rect.top - 52, 8);
  const left = rect.left + rect.width / 2;

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onDismiss]);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        transform: "translateX(-50%)",
        zIndex: 2147483647,
      }}
      className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {ACTIONS.map((a) => (
        <button
          key={a.value}
          onClick={() => onAction(a.value)}
          className="px-2.5 py-1 text-xs font-medium text-white rounded-md hover:bg-lumen-600 transition-colors whitespace-nowrap"
        >
          {a.label}
        </button>
      ))}
      <div className="w-px h-4 bg-gray-600 mx-0.5" />
      <button
        onClick={onBookmark}
        title="Bookmark page"
        className="p-1 text-gray-400 hover:text-yellow-400 transition-colors"
      >
        <BookmarkIcon />
      </button>
    </div>
  );
}

function BookmarkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3.5 h-3.5"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
