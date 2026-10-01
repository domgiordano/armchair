"use client";

import { useState } from "react";

import { PRIMARY, SECONDARY } from "@/lib/ui";

interface RevealAllProps {
  open: number;
  onConfirm: () => Promise<void>;
}

type Step = { kind: "idle" } | { kind: "confirm" } | { kind: "sending" } | { kind: "error"; message: string };

/** Catch-up for a week already watched: forfeit everything still unanswered. */
export function RevealAll({ open, onConfirm }: RevealAllProps) {
  const [step, setStep] = useState<Step>({ kind: "idle" });

  if (step.kind === "idle") {
    return (
      <button type="button" onClick={() => setStep({ kind: "confirm" })} className={`${SECONDARY} self-start`}>
        Reveal all
      </button>
    );
  }

  const send = async () => {
    setStep({ kind: "sending" });
    try {
      await onConfirm();
      setStep({ kind: "idle" });
    } catch (e) {
      setStep({ kind: "error", message: e instanceof Error ? e.message : "Request failed" });
    }
  };
  const busy = step.kind === "sending";

  return (
    <div role="group" aria-label="Reveal all" className="flex flex-col gap-3 rounded-xl border border-gold/30 bg-ballroom/60 p-4 animate-pop-in">
      <p className="font-semibold text-pearl">
        Reveal the {open} {open === 1 ? "dance" : "dances"} you haven&apos;t scored?
      </p>
      <p className="text-sm text-silver-dim">
        This is final. You&apos;ll see every score and the result, but you can&apos;t score these later.
      </p>
      {step.kind === "error" && (
        <p role="alert" className="text-sm text-red-300">
          Not revealed: {step.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {/* The button that opened this step is gone, so focus lands here instead of <body>. */}
        <button type="button" autoFocus disabled={busy} onClick={() => void send()} className={PRIMARY}>
          {busy ? "Revealing..." : "Reveal all"}
        </button>
        <button type="button" disabled={busy} onClick={() => setStep({ kind: "idle" })} className={SECONDARY}>
          Cancel
        </button>
      </div>
    </div>
  );
}
