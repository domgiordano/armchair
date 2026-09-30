"use client";

import { useEffect, useRef, useState } from "react";

import type { Answer } from "@/lib/api/show";
import { PRIMARY, SECONDARY } from "@/lib/ui";

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type Step =
  | { kind: "pick" }
  | { kind: "confirm"; answer: Answer }
  | { kind: "sending"; answer: Answer }
  | { kind: "error"; answer: Answer; message: string };

interface PaddlePickerProps {
  /** Who is being scored, for the paddles' accessible names. */
  label: string;
  /** Set before the episode airs: paddles show but can't be used. */
  airsOn: string | null;
  onSubmit: (answer: Answer) => Promise<void>;
}

interface PaddleProps {
  value: number;
  label: string;
  disabled: boolean;
  onPick: () => void;
}

/** A judge's handheld number paddle: a face on a short handle. */
function Paddle({ value, label, disabled, onPick }: PaddleProps) {
  return (
    <button
      type="button"
      data-pick={value}
      aria-label={`Score ${value} for ${label}`}
      disabled={disabled}
      onClick={onPick}
      className="group flex min-h-20 flex-col items-center rounded-md pt-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="flex h-14 w-full items-center justify-center rounded-md border-2 border-amber-600 bg-stone-200 text-2xl font-bold tabular-nums text-stone-900 shadow-sm transition-transform group-hover:-translate-y-1 group-hover:bg-stone-100 group-active:translate-y-0 group-active:bg-amber-300 group-disabled:translate-y-0 motion-reduce:transition-none">
        {value}
      </span>
      <span aria-hidden="true" className="h-4 w-2 rounded-b-sm bg-stone-500" />
    </button>
  );
}

export function PaddlePicker({ label, airsOn, onSubmit }: PaddlePickerProps) {
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const confirmRef = useRef<HTMLButtonElement>(null);
  const pickRef = useRef<HTMLDivElement>(null);
  const backTo = useRef<string | null>(null);

  // Each step swaps the buttons out from under the finger that pressed them, so
  // focus follows: to the confirm button, and back to what was picked.
  useEffect(() => {
    if (step.kind === "confirm") confirmRef.current?.focus();
    if (step.kind === "pick" && backTo.current) {
      pickRef.current?.querySelector<HTMLElement>(`[data-pick="${backTo.current}"]`)?.focus();
    }
  }, [step.kind]);

  const back = (answer: Answer) => {
    backTo.current = "forfeit" in answer ? "forfeit" : String(answer.value);
    setStep({ kind: "pick" });
  };

  const send = async (answer: Answer) => {
    setStep({ kind: "sending", answer });
    try {
      await onSubmit(answer);
    } catch (e) {
      setStep({ kind: "error", answer, message: e instanceof Error ? e.message : "Request failed" });
    }
  };

  if (step.kind === "pick") {
    return (
      <div ref={pickRef} className="flex flex-col gap-3">
        <div className="grid grid-cols-5 gap-2">
          {VALUES.map((v) => (
            <Paddle
              key={v}
              value={v}
              label={label}
              disabled={airsOn !== null}
              onPick={() => setStep({ kind: "confirm", answer: { value: v } })}
            />
          ))}
        </div>
        {airsOn !== null ? (
          <p className="text-sm text-neutral-400">Airs {airsOn}</p>
        ) : (
          <button
            type="button"
            data-pick="forfeit"
            onClick={() => setStep({ kind: "confirm", answer: { forfeit: true } })}
            className="min-h-11 self-start rounded-md text-sm text-neutral-300 underline underline-offset-4 hover:text-neutral-100 active:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            Reveal without scoring
          </button>
        )}
      </div>
    );
  }

  const { answer } = step;
  const forfeit = "forfeit" in answer;
  const busy = step.kind === "sending";

  return (
    <div role="group" aria-label={`Confirm for ${label}`} className="flex flex-col gap-3">
      <div aria-live="polite" className="flex items-center gap-4">
        {!forfeit && (
          <span className="flex h-14 w-12 items-center justify-center rounded-md border-2 border-amber-600 bg-amber-300 text-2xl font-bold tabular-nums text-amber-950">
            {answer.value}
          </span>
        )}
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{forfeit ? "Reveal without scoring?" : "Scores are final"}</p>
          <p className="text-sm text-neutral-400">
            {forfeit
              ? "This is final. You'll see the scores, but you can't score this dance later."
              : "You can't change it after you lock it in."}
          </p>
        </div>
      </div>
      {step.kind === "error" && (
        <p role="alert" className="text-sm text-red-300">
          Not saved: {step.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          ref={confirmRef}
          type="button"
          disabled={busy}
          onClick={() => void send(answer)}
          className={PRIMARY}
        >
          {busy ? "Saving..." : forfeit ? "Reveal" : `Lock in ${answer.value}`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => back(answer)}
          className={SECONDARY}
        >
          {forfeit ? "Cancel" : "Change"}
        </button>
      </div>
    </div>
  );
}
