"use client";

import { useEffect, type CSSProperties } from "react";

import { useReducedMotion } from "@/lib/motion";

/** Spread on an element to rise it in when it scrolls into view; `i` steps it into a stagger. */
export const reveal = (i = 0) => ({ "data-reveal": "", style: { "--reveal-delay": `${i * 90}ms` } as CSSProperties });

/**
 * Rises each [data-reveal] element in as it scrolls into view. Content is only
 * hidden once this has run, so without JS or under reduced motion it just shows.
 */
export function ScrollReveals() {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || typeof IntersectionObserver === "undefined") return;
    const html = document.documentElement;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-shown", "");
          io.unobserve(e.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    html.classList.add("reveals");
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      html.classList.remove("reveals");
    };
  }, [reduced]);

  return null;
}
