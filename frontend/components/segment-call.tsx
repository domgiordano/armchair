"use client";

import { useState } from "react";

import type { CallKind, CallOutcome, Contestant, SegmentCall } from "@/lib/api/show";
import { ordinal } from "@/lib/show/couples";
import { closesOn } from "@/lib/show/window";
import { cn, EYEBROW, PRIMARY } from "@/lib/ui";

interface SegmentCallsProps {
  calls: SegmentCall[];
  /** The couples dancing on their own tonight: what a call may name. */
  couples: Contestant[];
  tz: string;
  now: number;
  /** The results may show here, as with the bonus points beside them. */
  reveal: boolean;
  onCall: (kind: CallKind, picks: string[]) => Promise<void>;
}

const celebrity = (c: Contestant) => c.members.find((m) => m.role === "celebrity")?.name ?? c.id;

const TITLE: Record<CallKind, string> = { marathon: "Marathon call", "dance-off": "Dance-off call" };

function outcomeText(outcome: CallOutcome): string {
  if ("hits" in outcome) {
    return `You called ${outcome.hits} of ${outcome.winners} dance-off ${outcome.winners === 1 ? "winner" : "winners"}`;
  }
  if (outcome.place === null) return "Your pick isn't in the marathon results";
  return `Your pick finished ${ordinal(outcome.place)} of ${outcome.of} in the marathon`;
}

/** Optional calls on the night's marathon or dance-off: blind and final, and never part of the scorecard. */
export function SegmentCalls({ calls, ...rest }: SegmentCallsProps) {
  return calls.map((call) => <CallCard key={call.kind} call={call} {...rest} />);
}

type Step = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string };

interface CallCardProps extends Omit<SegmentCallsProps, "calls"> {
  call: SegmentCall;
}

function CallCard({ call, couples, tz, now, reveal, onCall }: CallCardProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const names = new Map(couples.map((c) => [c.id, celebrity(c)]));

  const locked = call.locksAt !== null && now >= Date.parse(call.locksAt);

  if (call.picks !== null || locked) {
    return (
      <section aria-label={TITLE[call.kind]} className="flex flex-col gap-1 rounded-lg border border-silver/15 bg-ink/40 px-3 py-2.5 text-sm text-silver">
        <h2 className={EYEBROW}>{TITLE[call.kind]}</h2>
        {call.picks === null ? (
          <p>No call made</p>
        ) : (
          <p>
            Your call: <span className="text-pearl">{call.picks.map((id) => names.get(id) ?? id).join(", ")}</span>
          </p>
        )}
        {reveal && call.outcome && <p className="font-semibold text-gold-light">{outcomeText(call.outcome)}</p>}
      </section>
    );
  }
  if (!call.open) return null;

  const single = call.kind === "marathon";
  const full = picked.length >= call.limit;
  const busy = step.kind === "sending";
  const toggle = (id: string) =>
    setPicked((p) => (single ? [id] : p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const send = async () => {
    setStep({ kind: "sending" });
    try {
      await onCall(call.kind, picked);
      setStep({ kind: "idle" });
    } catch (e) {
      setStep({ kind: "error", message: e instanceof Error ? e.message : "Request failed" });
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      className="flex flex-col gap-3 rounded-xl border border-gold/30 bg-ballroom/60 p-4"
    >
      <fieldset disabled={busy} className="flex flex-col gap-2">
        <legend className={EYEBROW}>{TITLE[call.kind]}</legend>
        <p className="text-sm text-pearl">
          {single
            ? "Who lasts longest in the marathon?"
            : `Who wins their dance-off? Pick up to ${call.limit}.`}
        </p>
        <p className="text-xs text-silver-dim">
          {call.locksAt && <>Calls lock at showtime, {closesOn(call.locksAt, tz)}. </>}
          Optional and final once locked in. It doesn&apos;t count toward your scorecard.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {couples.map((c) => {
            const on = picked.includes(c.id);
            const closed = !single && full && !on;
            return (
              <label
                key={c.id}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg border border-silver/15 px-3 text-sm text-pearl transition-colors has-checked:border-gold/60 has-checked:bg-gold/10 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-gold-light",
                  closed ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-silver/30 hover:bg-silver/5",
                )}
              >
                <input
                  type={single ? "radio" : "checkbox"}
                  name={`call-${call.kind}`}
                  checked={on}
                  disabled={closed}
                  onChange={() => toggle(c.id)}
                  className="size-5 shrink-0 accent-gold"
                />
                {celebrity(c)}
              </label>
            );
          })}
        </div>
      </fieldset>
      {step.kind === "error" && (
        <p role="alert" className="text-sm text-red-300">
          Not saved: {step.message}
        </p>
      )}
      <button type="submit" disabled={busy || picked.length === 0} className={`${PRIMARY} self-start`}>
        {busy ? "Locking in..." : "Lock in call"}
      </button>
    </form>
  );
}
