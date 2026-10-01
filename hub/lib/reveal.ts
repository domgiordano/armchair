import type { CSSProperties } from "react";

/** Spread on an element to fade it up on scroll (components/scroll-reveals.tsx), `i` steps into a stagger. */
export const reveal = (i = 0) => ({
  "data-reveal": "",
  style: { "--reveal-delay": `${i * 90}ms` } as CSSProperties,
});
