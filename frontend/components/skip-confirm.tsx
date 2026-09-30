"use client";

import { useState } from "react";

import { PRIMARY, SECONDARY } from "@/lib/ui";

interface SkipConfirmProps {
  title: string;
  // Where the forfeits land, e.g. "in those 3 episodes" or "this season".
  scope: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/** The last step before /scores/skip-before: says what is given up, then sends it. */
export function SkipConfirm({ title, scope, confirmLabel, onConfirm, onCancel }: SkipConfirmProps) {
  const [step, setStep] = useState<{ kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string }>({
    kind: "idle",
  });
  const busy = step.kind === "sending";

  const send = async () => {
    setStep({ kind: "sending" });
    try {
      await onConfirm();
    } catch (e) {
      setStep({ kind: "error", message: e instanceof Error ? e.message : "Request failed" });
    }
  };

  return (
    <div role="group" aria-label={title} className="flex flex-col gap-3 rounded-lg border border-neutral-700 p-4">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-neutral-400">
        Every dance you haven&apos;t scored {scope} is revealed without a score. This is final: they won&apos;t count
        toward your accuracy and you can&apos;t score them later.
      </p>
      {step.kind === "error" && (
        <p role="alert" className="text-sm text-red-300">
          Nothing skipped: {step.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {/* The button that opened this step is gone, so focus lands here instead of <body>. */}
        <button type="button" autoFocus disabled={busy} onClick={() => void send()} className={PRIMARY}>
          {busy ? "Revealing..." : confirmLabel}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className={SECONDARY}>
          Cancel
        </button>
      </div>
    </div>
  );
}
