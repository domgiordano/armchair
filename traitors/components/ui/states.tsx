import type { ReactNode } from "react";

import { button, cn } from "@/lib/ui";

interface EmptyStateProps {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}

/** Nothing here yet: a candle, a line of what will appear, and what to do about it. */
export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-gilt/30 bg-night/40 px-6 py-10 text-center">
      <CandleIcon />
      {title && <p className="font-display font-semibold tracking-[0.06em] text-bone">{title}</p>}
      <div className="max-w-sm leading-relaxed text-ash">{children}</div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  what: string;
  message: string;
  retry: () => void;
  className?: string;
}

/** A failed load, with the reason and a retry. */
export function ErrorState({ what, message, retry, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-start gap-3 rounded-sm border border-blood-hi/40 bg-oxblood/30 p-4", className)}>
      <p className="text-bone">
        Could not load {what}: {message}
      </p>
      <button type="button" onClick={retry} className={button("outline", "sm")}>
        Try again
      </button>
    </div>
  );
}

function CandleIcon() {
  return (
    <svg viewBox="0 0 24 32" aria-hidden="true" className="h-8 w-6">
      <path d="M12 3c-1.5 2-2.5 3.5-2.5 5a2.5 2.5 0 0 0 5 0c0-1.5-1-3-2.5-5Z" fill="var(--candle)" className="animate-flicker" />
      <rect x={8} y={12} width={8} height={16} rx={1} fill="var(--parchment)" opacity={0.85} />
      <rect x={5} y={28} width={14} height={2} rx={1} fill="var(--gilt)" />
    </svg>
  );
}
