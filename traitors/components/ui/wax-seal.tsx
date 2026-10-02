"use client";

import { useState } from "react";

import { cn, FOCUS } from "@/lib/ui";

// A wax blob: a circle with a lumpy rim, the same on every render.
const RIM = Array.from({ length: 36 }, (_, i) => {
  const a = (i / 36) * Math.PI * 2;
  const r = 45 + [2, -1, 1, -2, 0, 1][i % 6];
  return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
}).join(" ");

/** Our seal: an empty hood, never a face and never the show's emblem. */
export function Seal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <polygon points={RIM} fill="var(--blood)" stroke="var(--oxblood)" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={50} cy={50} r={34} fill="none" stroke="var(--oxblood)" strokeWidth={2.5} />
      <circle cx={50} cy={50} r={30} fill="none" stroke="rgb(224 70 79 / 0.6)" strokeWidth={1} />
      <path d="M50 24c-12 8-17 20-17 33 0 8 4 14 8 17h18c4-3 8-9 8-17 0-13-5-25-17-33Z" fill="var(--oxblood)" />
      <path d="M50 42c-6 4-8 10-8 16 0 4 2 7 4 9h8c2-2 4-5 4-9 0-6-2-12-8-16Z" fill="var(--night)" />
      <path d="M38 34c3-5 7-8 12-10" fill="none" stroke="rgb(244 236 218 / 0.35)" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

interface WaxSealProps {
  /** What pressing it does: "Seal your slate". */
  label: string;
  sealed: boolean;
  disabled?: boolean;
  /** Rejects to leave the seal unpressed; the caller says what went wrong. */
  onSeal: () => Promise<void>;
}

/**
 * Every final pick locks with this one gesture. The stamp plays only when it's
 * pressed here, not when a pick made earlier loads already sealed.
 */
export function WaxSeal({ label, sealed, disabled = false, onSeal }: WaxSealProps) {
  const [pressing, setPressing] = useState(false);
  const [stamped, setStamped] = useState(false);

  if (sealed) {
    return (
      <p className="flex items-center gap-3 font-display text-sm tracking-[0.12em] text-parchment uppercase">
        <Seal className={cn("size-12 drop-shadow-[0_4px_6px_rgb(0_0_0/0.6)]", stamped && "animate-stamp")} />
        Sealed. Final.
      </p>
    );
  }

  const press = async () => {
    setPressing(true);
    navigator.vibrate?.(20);
    try {
      await onSeal();
      setStamped(true);
    } finally {
      setPressing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void press().catch(() => {})}
      disabled={disabled || pressing}
      aria-busy={pressing}
      className={cn(
        "group flex min-h-14 items-center gap-3 rounded-sm py-1 pr-4 pl-1 font-display text-sm font-semibold tracking-[0.12em] text-bone uppercase transition-colors hover:bg-oxblood/60 active:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50",
        FOCUS,
      )}
    >
      <Seal
        className={cn(
          "size-12 transition-transform duration-200 group-hover:-rotate-6 group-active:scale-90 group-disabled:rotate-0",
          pressing ? "animate-stamp" : "drop-shadow-[0_6px_10px_rgb(0_0_0/0.7)]",
        )}
      />
      {pressing ? "Sealing..." : label}
    </button>
  );
}
