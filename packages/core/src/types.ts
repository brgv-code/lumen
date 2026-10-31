// Shared shapes for the API, the web app and the extension.

import type { HighlightColor } from "./colors.ts";
export type { HighlightColor } from "./colors.ts";

export const ITEM_STATUSES = ["inbox", "reading", "done", "archived"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_KINDS = ["article", "bookmark", "pdf", "video"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const DESTINATION_KINDS = ["obsidian", "notion", "markdown", "webhook"] as const;
export type DestinationKind = (typeof DESTINATION_KINDS)[number];

export const AI_ACTIONS = ["explain", "summarize", "define", "ask", "simplify", "expand"] as const;
export type AIAction = (typeof AI_ACTIONS)[number];

export type HighlightFormat = "house" | "callout" | "plain";

export interface User {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  isDemo: boolean;
  plan: "free" | "pro";
  planStatus: "trial" | "pro" | "free";
  pro: boolean;
  trialEndsAt: number;
  trialDaysLeft: number;
  billingInterest: boolean;
  dailyGoal: number;
  shareSignals: boolean;
  reminders: boolean;
  createdAt: number;
}

export interface Item {
  id: string;
  url: string;
  title: string;
  siteName: string | null;
  author: string | null;
  excerpt: string | null;
  coverUrl: string | null;
  kind: ItemKind;
  status: ItemStatus;
  progress: number;
  favorite: boolean;
  wordCount: number;
  readingMinutes: number;
  collectionId: string | null;
  tags: string[];
  highlightCount: number;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
}

export interface ItemWithContent extends Item {
  contentHtml: string | null;
}

/** W3C Web Annotation style text quote selector plus a position hint. */
export interface TextQuote {
  quote: string;
  prefix: string;
  suffix: string;
  position: number;
}

export interface Highlight extends TextQuote {
  id: string;
  itemId: string;
  color: HighlightColor;
  note: string | null;
  createdAt: number;
  updatedAt: number;
  item?: Pick<Item, "id" | "title" | "url" | "siteName">;
}

export interface Collection {
  id: string;
  name: string;
  emoji: string;
  color: "sun" | "mint" | "iris" | "peach" | "sky";
  description: string | null;
  destinationId: string | null;
  itemCount: number;
  highlightCount: number;
  createdAt: number;
}

export interface ObsidianConfig {
  baseUrl: string; // e.g. https://127.0.0.1:27124
  apiKey?: string; // stays in the browser; never sent to the server
  notePath: string; // e.g. Research/sparse-ai.md
  format: HighlightFormat;
}
export interface NotionConfig { pageId: string; token?: string; hasToken?: boolean }
export interface MarkdownConfig { fileName: string; format: HighlightFormat }
export interface WebhookConfig { url: string; hasSecret?: boolean }

export interface Destination {
  id: string;
  kind: DestinationKind;
  name: string;
  config: Record<string, unknown>;
  pendingCount: number;
  deliveredCount: number;
  lastDeliveredAt: number | null;
  createdAt: number;
}

export interface Stats {
  streak: number;
  bestStreak: number;
  glowToday: number;
  dailyGoal: number;
  glowTotal: number;
  week: { day: string; glow: number }[];
  counts: { inbox: number; reading: number; done: number; highlights: number; notes: number };
  level: { name: string; index: number; progress: number; next: number };
}

export interface Idea {
  id: string;
  title: string;
  angle: string;
  outline: string[];
  sourceItemIds: string[];
  status: "new" | "saved" | "dismissed";
  createdAt: number;
}

export interface Page<T> { data: T[]; nextCursor: string | null }

export interface ApiError { error: { code: string; message: string } }
