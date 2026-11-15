// The reader's Ask styles (ADR-005), cached so the panel shows pills before Lumen answers.
import { upgradeAskPrefs, type StyleListing } from "@lumen/core";

const CACHE = "lumen_styles";
const DISMISSED = "lumen_style_offers_dismissed"; // styles the reader said "Not now" to making default

export const NO_STYLES: StyleListing = { styles: [], prefs: upgradeAskPrefs(null), usage: {}, pro: false };

export interface StyleCache {
  read(): Promise<StyleListing | null>;
  write(listing: StyleListing): Promise<void>;
}

export const storageCache: StyleCache = {
  read: async () => (await chrome.storage.local.get(CACHE))[CACHE] ?? null,
  write: (listing) => chrome.storage.local.set({ [CACHE]: listing }),
};

/** Lumen's listing when it answers, else the cached one, else only the built ins. */
export async function freshStyles(cache: StyleCache, fetchListing: () => Promise<StyleListing>): Promise<StyleListing> {
  try {
    const listing = await fetchListing();
    await cache.write(listing);
    return listing;
  } catch (error) {
    console.warn("styles stay cached", error);
    return (await cache.read()) ?? NO_STYLES;
  }
}

export async function dismissedOffers(): Promise<string[]> {
  return (await chrome.storage.local.get(DISMISSED))[DISMISSED] ?? [];
}

export async function dismissOffer(key: string): Promise<string[]> {
  const next = [...new Set([...(await dismissedOffers()), key])];
  await chrome.storage.local.set({ [DISMISSED]: next });
  return next;
}
