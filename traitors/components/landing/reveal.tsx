"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/ui";

import styles from "./landing.module.css";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Milliseconds after it scrolls into view, to stagger siblings. */
  delay?: number;
}

/**
 * Rises into place the first time it scrolls into view. Without
 * IntersectionObserver it's simply there; reduced motion skips the rise in CSS.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const el = ref.current;
    if (shown || !el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return (
    <div
      ref={ref}
      data-shown={shown || undefined}
      className={cn(styles.reveal, className)}
      style={{ "--delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
