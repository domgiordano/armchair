"use client";

import type { CSSProperties } from "react";

import { DemoPause } from "@/components/demo-pause";
import { useCycle } from "@/lib/use-cycle";

// Invented. No real couples, judges or scores.
const JUDGES = ["Rhea", "Marco", "Dee"];
const DANCES = [
  { label: "Week 3 · Foxtrot", you: 7, judges: [7, 8, 6] },
  { label: "Week 3 · Samba", you: 9, judges: [8, 9, 9] },
  { label: "Week 3 · Tango", you: 6, judges: [7, 6, 8] },
];
const CYCLE_MS = 6500;
const YOU_AT = 300;
const JUDGE_AT = 1500;
const JUDGE_STEP = 420;


interface PaddleProps {
  name: string;
  value: number;
  delay: number;
  you?: boolean;
  gap?: number;
}

function Paddle({ name, value, delay, you = false, gap }: PaddleProps) {
  const at = { "--delay": `${delay}ms` } as CSSProperties;
  return (
    <div className="flex flex-col items-center">
      <div className="flip" style={at}>
        <div className="flip-inner relative h-16 w-13 sm:h-20 sm:w-16">
          <span
            className={`flip-face absolute inset-0 flex items-center justify-center rounded-xl text-2xl font-extrabold tabular-nums shadow-lg shadow-night/60 sm:text-3xl ${
              you ? "bg-linear-to-br from-[#f3d98b] to-[#c99a2e] text-[#1a1406]" : "bg-[#f3e6c0] text-[#0a1440]"
            }`}
          >
            {value}
          </span>
          <span className="flip-face flip-back absolute inset-0 rounded-xl border-2 border-[#f3d98b]/60 bg-[repeating-linear-gradient(45deg,#16245e_0_6px,#0f1a4a_6px_12px)]" />
        </div>
      </div>
      <span className="h-5 w-1.5 rounded-b-sm bg-[#9aa4c4]/50" aria-hidden="true" />
      <span className="mt-2 text-xs font-medium text-[#f3e6c0]/80">{name}</span>
      <span className="flip-gap mt-1 h-5 text-[11px] font-semibold tabular-nums" style={at}>
        {gap === undefined ? null : (
          <span className={gap === 0 ? "text-[#f3d98b]" : "text-[#f3e6c0]/60"}>{gap === 0 ? "dead on" : gap > 0 ? `${gap} over` : `${-gap} under`}</span>
        )}
      </span>
    </div>
  );
}

/** Your paddle, then each judge's flipping over beside it, with how far you were from each. */
export function PaddleFlipDemo() {
  const { ref, index, still, paused, toggle, frameKey } = useCycle<HTMLElement>(DANCES.length, CYCLE_MS);
  const d = DANCES[index];
  const gaps = d.judges.map((j) => d.you - j);
  const closest = JUDGES[gaps.map(Math.abs).indexOf(Math.min(...gaps.map(Math.abs)))];
  const spoken = `${d.label}. You held up ${d.you}. ${JUDGES.map((j, i) => `${j} ${d.judges[i]}`).join(", ")}. Closest to ${closest}.`;

  return (
    <figure
      ref={ref}
      className="relative rounded-3xl border border-[#2b3a7a] bg-linear-to-b from-[#0a1440] to-[#060b26] p-5 text-[#f3e6c0] shadow-2xl shadow-night sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tracking-[0.18em] uppercase">{d.label}</span>
        <span className="rounded-full border border-[#f3e6c0]/25 px-3 py-1 text-[11px] text-[#f3e6c0]/70">Illustration</span>
      </div>
      <div key={frameKey} className="demo">
        <div role="img" aria-label={spoken} className="mt-6 grid grid-cols-4 gap-2">
          <Paddle name="You" value={d.you} delay={YOU_AT} you />
          {JUDGES.map((name, i) => (
            <Paddle key={name} name={name} value={d.judges[i]} delay={JUDGE_AT + i * JUDGE_STEP} gap={gaps[i]} />
          ))}
        </div>
        <p className="flip-gap mt-4 pr-10 text-sm text-[#f3e6c0]/80" style={{ "--delay": `${JUDGE_AT + 3 * JUDGE_STEP}ms` } as CSSProperties} aria-hidden="true">
          Closest to <span className="font-semibold text-[#f3d98b]">{closest}</span> this dance. Your stats keep the gap to each judge,
          all season.
        </p>
      </div>
      {!still && <DemoPause paused={paused} onToggle={toggle} className="absolute right-2 bottom-2" />}
    </figure>
  );
}
