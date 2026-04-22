import React, { useEffect, useState } from "react";
import type { SavedItem, AIItem, BookmarkItem } from "../../lib/types";

export default function Popup() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const resp = await chrome.runtime.sendMessage({ type: "GET_ITEMS" });
    setItems(resp.items ?? []);
  }

  async function handleDelete(id: string) {
    await chrome.runtime.sendMessage({ type: "DELETE_ITEM", id });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleClearAll() {
    await chrome.runtime.sendMessage({ type: "CLEAR_ALL" });
    setItems([]);
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  return (
    <div className="w-[400px] max-h-[560px] bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="font-semibold text-lumen-400 tracking-wide">Lumen</span>
        <button
          onClick={openOptions}
          title="Settings"
          className="text-gray-400 hover:text-gray-200 transition-colors"
        >
          <SettingsIcon />
        </button>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600 text-sm">
            <p>No saved items yet.</p>
            <p className="mt-1 text-xs">Highlight text on any page to get started.</p>
          </div>
        ) : (
          items.map((item) =>
            item.type === "ai" ? (
              <AIItemCard
                key={item.id}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() =>
                  setExpandedId(expandedId === item.id ? null : item.id)
                }
                onDelete={() => handleDelete(item.id)}
              />
            ) : (
              <BookmarkItemCard
                key={item.id}
                item={item}
                onDelete={() => handleDelete(item.id)}
              />
            )
          )
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-800">
          <button
            onClick={handleClearAll}
            className="w-full py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function AIItemCard({
  item,
  expanded,
  onToggle,
  onDelete,
}: {
  item: AIItem;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="px-4 py-3 hover:bg-gray-900/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-1.5 py-0.5 rounded bg-lumen-900/60 text-lumen-400 font-medium capitalize">
              {item.action}
            </span>
            <span className="text-xs text-gray-500 truncate">{item.pageTitle}</span>
          </div>
          <p className="text-xs text-gray-400 truncate italic">"{item.selectedText}"</p>
        </div>
        <button
          onClick={onDelete}
          className="text-gray-600 hover:text-red-400 transition-colors shrink-0 mt-0.5"
        >
          <TrashIcon />
        </button>
      </div>

      <button
        onClick={onToggle}
        className="mt-2 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
      >
        <ChevronIcon expanded={expanded} />
        {expanded ? "Hide result" : "Show result"}
      </button>

      {expanded && (
        <div className="mt-2 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto">
          {item.result}
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-2">
        <a
          href={item.pageUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-lumen-500 hover:text-lumen-400 truncate transition-colors"
        >
          {new URL(item.pageUrl).hostname}
        </a>
        <span className="text-xs text-gray-700">·</span>
        <span className="text-xs text-gray-600">
          {new Date(item.timestamp).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

function BookmarkItemCard({
  item,
  onDelete,
}: {
  item: BookmarkItem;
  onDelete: () => void;
}) {
  return (
    <div className="px-4 py-3 hover:bg-gray-900/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {item.favicon ? (
            <img src={item.favicon} className="w-4 h-4 mt-0.5 rounded-sm shrink-0" />
          ) : (
            <span className="w-4 h-4 mt-0.5 text-yellow-500 shrink-0">
              <BookmarkFilledIcon />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-500 font-medium">
                Bookmark
              </span>
            </div>
            <p className="text-xs text-gray-200 truncate">{item.pageTitle}</p>
            <a
              href={item.pageUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-lumen-500 hover:text-lumen-400 truncate transition-colors"
            >
              {new URL(item.pageUrl).hostname}
            </a>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-gray-600 hover:text-red-400 transition-colors shrink-0 mt-0.5"
        >
          <TrashIcon />
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-600">
        {new Date(item.timestamp).toLocaleDateString()}
      </p>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-3.5 h-3.5">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function BookmarkFilledIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
      className="w-4 h-4">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
