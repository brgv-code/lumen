// Small inline icons (Lucide shapes) for the in page UI.
import { BAR_LABEL, ICON_SHAPES, iconMarkup, type IconName } from "@lumen/core";

export const ICON = Object.fromEntries(Object.keys(ICON_SHAPES).map((name) => [name, iconMarkup(name as IconName)])) as Record<IconName, string>;
export const LABEL: Record<string, string> = BAR_LABEL;
export const LAMP = `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB53D"/><stop offset="1" stop-color="#FF6A1A"/></linearGradient><radialGradient id="ls" cx=".5" cy=".15" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="64" height="64" rx="18" fill="url(#lg)"/><rect width="64" height="64" rx="18" fill="url(#ls)"/><path d="M20 44h24" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="27" r="9" fill="#fff"/><path d="M32 10v3M47 27h-3M20 27h-3M42.6 16.4l-2.1 2.1M23.5 18.5l-2.1-2.1" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;
