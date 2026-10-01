import { useSyncExternalStore } from "react";

// The intro (components/intro.tsx) marks <html data-intro="playing"> while it
// covers the page, so motion underneath can hold until the landing is visible.

export const introPlaying = () => document.documentElement.dataset.intro === "playing";

export function subscribeIntro(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["data-intro"] });
  return () => observer.disconnect();
}

export function useIntroPlaying(): boolean {
  return useSyncExternalStore(subscribeIntro, introPlaying, () => false);
}

/** Calls `onEnter` once `el` scrolls into view, holding it while the intro is up. */
export function onceInView(el: Element, onEnter: () => void): () => void {
  let unsubscribe = () => {};
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      if (!introPlaying()) return onEnter();
      unsubscribe = subscribeIntro(() => {
        if (introPlaying()) return;
        unsubscribe();
        onEnter();
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
  );
  io.observe(el);
  return () => {
    io.disconnect();
    unsubscribe();
  };
}
