"use client";

import { useEffect, useRef } from "react";

import { Paddle } from "@/components/paddle";
import { Sheet } from "@/components/ui/sheet";
import { button } from "@/lib/ui";

interface RevealSheetProps {
  /** The dance just locked in, or null when the sheet is closed. */
  locked: { title: string; value: number } | null;
  onReveal: () => void;
  onClose: () => void;
}

/** After a lock-in: reveal the judges now, or wait for their paddles on TV first. */
export function RevealSheet({ locked, onReveal, onClose }: RevealSheetProps) {
  const reveal = useRef<HTMLButtonElement>(null);
  const open = locked !== null;
  // WebKit's showModal focuses the dialog's close button, not autofocus; Reveal is the likely next tap.
  useEffect(() => {
    if (open) reveal.current?.focus();
  }, [open]);

  return (
    <Sheet open={locked !== null} onClose={onClose} label="Locked in">
      {locked && (
        <div className="flex flex-col items-center gap-5 pt-2 text-center">
          <Paddle face={String(locked.value)} tone="you" className="w-20 animate-raise" />
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Locked in</p>
            <h2 className="text-xl font-semibold text-pearl">Ready to see the judges?</h2>
            <p className="text-sm text-silver-dim">
              You gave {locked.title} {locked.value === 8 ? "an" : "a"} {locked.value}. Wait for the panel on TV if you don&apos;t want it spoiled.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row-reverse sm:justify-center">
            <button ref={reveal} type="button" onClick={onReveal} className={button("primary")}>
              Reveal judges&apos; scores
            </button>
            <button type="button" onClick={onClose} className={button("secondary")}>
              Not yet
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
