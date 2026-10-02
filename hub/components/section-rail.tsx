"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "top", label: "Top" },
  { id: "shows", label: "Shows" },
  { id: "how", label: "How it works" },
  { id: "features", label: "What you get" },
  { id: "night", label: "Show night" },
  { id: "account", label: "One account" },
  { id: "faq", label: "FAQ" },
];

export function SectionRail() {
  const [active, setActive] = useState("top");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      // A section is current while it crosses the middle of the viewport.
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label="Sections" className="fixed top-1/2 left-4 z-30 hidden -translate-y-1/2 flex-col xl:flex">
      {SECTIONS.map(({ id, label }) => {
        const current = id === active;
        return (
          <a
            key={id}
            href={`#${id}`}
            aria-label={label}
            aria-current={current ? "location" : undefined}
            className="group flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-gold"
          >
            <span
              className={`block w-2 rounded-full transition-all motion-reduce:transition-none ${
                current ? "h-6 bg-linear-to-b from-blue via-magenta to-orange" : "h-2 bg-muted/40 group-hover:bg-muted"
              }`}
            />
          </a>
        );
      })}
    </nav>
  );
}
