import { useId } from "react";

import styles from "./loader.module.css";

interface LoaderProps {
  label?: string;
}

/**
 * A whole page while it loads: a faceless hooded figure over a candle. The
 * label is for screen readers only.
 */
export function Loader({ label = "Loading" }: LoaderProps) {
  // Gradient ids are page-global; two loaders on a page mustn't share them.
  const id = useId();
  return (
    <div className="flex min-h-dvh w-full items-center justify-center">
      <div role="status" aria-live="polite" className={styles.loader}>
        <svg viewBox="0 0 120 150" width="96" height="120" aria-hidden="true">
          <defs>
            <radialGradient id={`${id}-glow`} cx="60" cy="132" r="70" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--flame)" stopOpacity="0.55" />
              <stop offset="0.45" stopColor="var(--ember)" stopOpacity="0.16" />
              <stop offset="1" stopColor="var(--ember)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${id}-cloak`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0f2418" />
              <stop offset="0.7" stopColor="var(--cloak-500)" />
              <stop offset="1" stopColor="#3d5a2e" />
            </linearGradient>
            <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0.35" stopColor="var(--gilt)" stopOpacity="0" />
              <stop offset="1" stopColor="var(--flame)" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="132" r="70" fill={`url(#${id}-glow)`} className={styles.glow} />
          <g className={styles.hood}>
            {/* Crown to a point at the back, falling to the shoulders. */}
            <path
              d="M60 6 C44 10 30 26 27 50 C25 66 22 84 12 104 C6 116 4 126 4 134 L116 134 C116 126 114 116 108 104 C98 84 95 66 93 50 C90 26 76 10 60 6 Z"
              fill={`url(#${id}-cloak)`}
              stroke={`url(#${id}-rim)`}
              strokeWidth="1.5"
            />
            {/* The opening, and nothing in it. */}
            <path d="M60 34 C47 36 40 50 40 66 C40 84 49 96 60 100 C71 96 80 84 80 66 C80 50 73 36 60 34 Z" fill="#000" />
            <path d="M60 30 C45 32 36 48 36 66 C36 86 47 100 60 104" fill="none" stroke="#0a170f" strokeWidth="3" />
          </g>
          <rect x="55" y="128" width="10" height="20" rx="1.5" fill="var(--parchment)" opacity="0.92" />
          <path className={styles.flame} d="M60 112 C63 118 65 122 64 125 C63 128 57 128 56 125 C55 122 57 118 60 112 Z" fill="var(--flame)" />
        </svg>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}
