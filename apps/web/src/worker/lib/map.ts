import type { Item, Highlight, Collection, Destination, Idea, User } from "@lumen/core";
import type { SessionUser } from "../env";

type Row = Record<string, any>;

export const toUser = (u: SessionUser): User => ({
  id: u.id,
  email: u.email,
  name: u.name,
  avatarUrl: u.avatar_url,
  isDemo: u.is_demo === 1,
  plan: u.plan === "pro" ? "pro" : "free",
  dailyGoal: u.daily_goal,
  shareSignals: Boolean(u.share_signals),
  reminders: Boolean(u.reminders),
  createdAt: u.created_at,
});

export const toItem = (r: Row): Item => ({
  id: r.id,
  url: r.url,
  title: r.title,
  siteName: r.site_name,
  author: r.author,
  excerpt: r.excerpt,
  coverUrl: r.cover_url,
  kind: r.kind,
  status: r.status,
  progress: r.progress,
  favorite: Boolean(r.favorite),
  wordCount: r.word_count,
  readingMinutes: r.reading_minutes,
  collectionId: r.collection_id,
  tags: r.tags ? String(r.tags).split(",").filter(Boolean) : [],
  highlightCount: r.highlight_count ?? 0,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  finishedAt: r.finished_at,
});

export const toHighlight = (r: Row): Highlight => ({
  id: r.id,
  itemId: r.item_id,
  quote: r.quote,
  prefix: r.prefix,
  suffix: r.suffix,
  position: r.position,
  color: r.color,
  note: r.note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  ...(r.item_title ? { item: { id: r.item_id, title: r.item_title, url: r.item_url, siteName: r.item_site } } : {}),
});

export const toCollection = (r: Row): Collection => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji,
  color: r.color,
  description: r.description,
  destinationId: r.destination_id,
  itemCount: r.item_count ?? 0,
  highlightCount: r.highlight_count ?? 0,
  createdAt: r.created_at,
});

export const toDestination = (r: Row): Destination => {
  const config = safeJson<Record<string, unknown>>(r.config, {});
  if (r.secret) config.hasSecret = true;
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    config,
    pendingCount: r.pending_count ?? 0,
    deliveredCount: r.delivered_count ?? 0,
    lastDeliveredAt: r.last_delivered_at ?? null,
    createdAt: r.created_at,
  };
};

export const toIdea = (r: Row): Idea => ({
  id: r.id,
  title: r.title,
  angle: r.angle,
  outline: safeJson(r.outline, []),
  sourceItemIds: safeJson(r.source_item_ids, []),
  status: r.status,
  createdAt: r.created_at,
});

export function safeJson<T>(s: unknown, fallback: T): T {
  try {
    return typeof s === "string" ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
