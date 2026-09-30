import type { ReactNode } from "react";

import { cn } from "@/lib/ui";

export type BadgeTone = "gold" | "silver" | "magenta" | "muted" | "danger";

const TONES: Record<BadgeTone, string> = {
  gold: "border-gold/40 bg-gold/10 text-gold-light",
  silver: "border-silver/25 bg-silver/5 text-silver",
  magenta: "border-brand-magenta/50 bg-brand-magenta/15 text-pearl",
  muted: "border-silver/15 text-silver-dim",
  danger: "border-red-300/40 bg-red-400/10 text-red-200",
};

interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}

/** A small status pill: "Owner", "Out", "Live". */
export function Badge({ tone = "silver", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-px text-[11px] leading-4 font-semibold tracking-[0.06em] uppercase",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
