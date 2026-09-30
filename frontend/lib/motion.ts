import { useSyncExternalStore } from "react";

// jsdom and old browsers have no matchMedia; every query reads false there.
const media = (query: string) => (typeof window === "undefined" ? undefined : window.matchMedia?.(query));

/** Whether a media query matches, kept live. False during the server render. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = media(query);
      m?.addEventListener("change", onChange);
      return () => m?.removeEventListener("change", onChange);
    },
    () => media(query)?.matches ?? false,
    () => false,
  );
}

export function useReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
