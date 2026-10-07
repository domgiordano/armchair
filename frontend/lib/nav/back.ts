import { withSeason } from "@/lib/show/seasons";

// Each entry's in-app depth rides in history.state, so a reload or a popstate
// reads it back. An unstamped entry is new when history.length grew since the
// last one. A push after going back leaves the length alone and reads as a
// replace: that only undercounts, and an undercount falls back to the parent
// link instead of history.back() off the site.
const KEY = "armchairDepth";
let last: { depth: number; length: number } | null = null;

/** Call once per URL change, after the router has written the entry. */
export function trackHistory(): void {
  const state = window.history.state as Record<string, unknown> | null;
  const stamped = state?.[KEY];
  const length = window.history.length;
  const depth =
    typeof stamped === "number" ? stamped : last === null ? 0 : length > last.length ? last.depth + 1 : last.depth;
  last = { depth, length };
  if (stamped !== depth) window.history.replaceState({ ...state, [KEY]: depth }, "");
}

/** Whether history.back() stays on this site. */
export const canGoBack = () => (last?.depth ?? 0) > 0;

/** For tests: forget the tracked entry, as a fresh page load would. */
export const resetHistory = () => {
  last = null;
};

/** Where Back goes without in-app history: the page this one hangs off. */
export function parentOf(pathname: string, params: URLSearchParams, season: string): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/couples/")) return withSeason("/couples/", season);
  switch (path) {
    case "/people":
      return withSeason("/discover/", season);
    case "/groups":
    case "/friends":
      return "/social/";
    case "/profile":
      return params.get("u") ? withSeason("/discover/", season) : withSeason("/", season);
  }
  return withSeason("/", season);
}
