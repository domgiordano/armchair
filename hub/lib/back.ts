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
