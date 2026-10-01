import type { ReactNode } from "react";

import { button, cn } from "@/lib/ui";

interface EmptyStateProps {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

/** Nothing here yet: a sparkle, a line of what will appear, and what to do about it. */
export function EmptyState({ title, children, action, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed border-silver/15 bg-ink/30 text-center",
        compact ? "px-4 py-5" : "px-6 py-10",
      )}
    >
      <Sparkle />
      {title && <p className="font-semibold text-pearl">{title}</p>}
      <div className="max-w-sm text-sm leading-relaxed text-silver-dim">{children}</div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  what: string;
  message: string;
  retry: () => void;
}

/** A failed load, with the reason and a retry. */
export function ErrorState({ what, message, retry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-red-300/25 bg-red-400/5 p-4">
      <div className="flex items-start gap-3">
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-red-300"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        >
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 6v4.5M10 13.5v.2" />
        </svg>
        <p className="text-sm text-pearl">
          Could not load {what}: {message}
        </p>
      </div>
      <button type="button" onClick={retry} className={button("secondary", "sm")}>
        Try again
      </button>
    </div>
  );
}

function Sparkle() {
  return (
    <svg viewBox="-1 -1 2 2" aria-hidden="true" className="size-5 fill-gold/80">
      <path d="M0-1C.1-.1.1-.1 1 0 .1.1.1.1 0 1-.1.1-.1.1-1 0-.1-.1-.1-.1 0-1Z" />
    </svg>
  );
}
