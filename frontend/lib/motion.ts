import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

// jsdom and old browsers have no matchMedia; treat them as motion-OK.
const media = () => (typeof window === "undefined" ? undefined : window.matchMedia?.(QUERY));

function subscribe(onChange: () => void) {
  const m = media();
  m?.addEventListener("change", onChange);
  return () => m?.removeEventListener("change", onChange);
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => media()?.matches ?? false, () => false);
}
