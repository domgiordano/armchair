"use client";

import { useState } from "react";

import { button, SECONDARY } from "@/lib/ui";

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
    <div
      role="group"
      aria-label={title}
      className="flex flex-col gap-3 rounded-xl border border-red-300/25 bg-red-400/[0.04] p-4 animate-pop-in"
    >
      <p className="flex items-center gap-2 font-semibold text-pearl">
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="size-5 shrink-0 text-red-300"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 3 2.5 16.5h15z" />
          <path d="M10 8.5v3.5M10 14.5v.2" />
        </svg>
        {title}
      </p>
      <p className="text-sm leading-relaxed text-silver-dim">
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
        <button type="button" autoFocus disabled={busy} onClick={() => void send()} className={button("danger")}>
          {busy ? "Revealing..." : confirmLabel}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className={SECONDARY}>
          Cancel
        </button>
      </div>
    </div>
  );
}
