"use client";

import { useEffect } from "react";

import { onceInView } from "@/lib/intro-state";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Fades each [data-reveal] element up as it scrolls into view. Content is only
 * hidden once this has run, so without JS or under reduced motion it just shows.
 */
export function ScrollReveals() {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const html = document.documentElement;
    html.classList.add("reveals");
    const stops = Array.from(document.querySelectorAll("[data-reveal]"), (el) =>
      onceInView(el, () => el.setAttribute("data-shown", "")),
    );
    return () => {
      for (const stop of stops) stop();
      html.classList.remove("reveals");
    };
  }, [reduced]);

  return null;
}
