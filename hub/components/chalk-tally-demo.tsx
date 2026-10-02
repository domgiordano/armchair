"use client";

import type { CSSProperties } from "react";

import { DemoPause } from "@/components/demo-pause";
import { useCycle } from "@/lib/use-cycle";

// Invented. No real players, seasons or results.
const NAMES = ["Wren", "Otis", "Mara", "Jules", "Ines"];
const EPISODES = [
  { label: "Episode 4", votes: [0, 2, 0, 1, 2, 0, 4, 0, 2], picks: [0, 2, 1] },
  { label: "Episode 5", votes: [3, 1, 3, 3, 1, 4, 3, 1, 3], picks: [1, 3, 4] },
];
const CYCLE_MS = 8000;
const FIRST_VOTE = 500;
const VOTE_STEP = 330;
const SLOT_POINTS = [5, 3, 2];

/** The round table's top three, most votes first; ties go to whoever reached the count first. */
export function finishOrder(votes: number[]): number[] {
  const count = new Map<number, number>();
  const reached = new Map<number, number>();
  votes.forEach((v, i) => {
    count.set(v, (count.get(v) ?? 0) + 1);
    reached.set(v, i);
  });
  return [...count.keys()].sort((a, b) => count.get(b)! - count.get(a)! || reached.get(a)! - reached.get(b)!).slice(0, 3);
}

/** Points for a top-3 slate, per the Traitors app's ledger: exact slot 5/3/2, right name wrong slot 1. */
export function slatePoints(picks: number[], finish: number[]): number[] {
  return picks.map((p, i) => (finish[i] === p ? SLOT_POINTS[i] : finish.includes(p) ? 1 : 0));
}

// One chalk stroke per vote: four uprights, then the fifth strikes through them.
function mark(n: number): string {
  const group = Math.floor(n / 5) * 34;
  if (n % 5 === 4) return `M${group - 2} 20 L${group + 24} 4`;
  const x = group + (n % 5) * 6;
  return `M${x} 2 L${x + 1} 22`;
}

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

/** A chalk slate tallying the round table's votes, the banished name circled, then your slate's points. */
export function ChalkTallyDemo() {
  const { ref, index, still, paused, toggle, frameKey } = useCycle<HTMLElement>(EPISODES.length, CYCLE_MS);
  const ep = EPISODES[index];
  const finish = finishOrder(ep.votes);
  const points = slatePoints(ep.picks, finish);
  const done = FIRST_VOTE + ep.votes.length * VOTE_STEP;
  const total = points.reduce((a, b) => a + b, 0);
  const spoken = `The Traitors, ${ep.label}, round table. ${NAMES.map((n, i) => `${n} ${ep.votes.filter((v) => v === i).length}`).join(", ")} votes. ${NAMES[finish[0]]} banished. Your slate scores ${total} points.`;

  return (
    <figure ref={ref} className="relative rounded-3xl border-[6px] border-[#4a3020] bg-[#3a2616] p-1.5 shadow-2xl shadow-night">
      <div className="chalk-board relative overflow-hidden rounded-2xl p-4 text-[#ece8dc] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="chalk-text text-sm tracking-[0.12em] uppercase">Round table &middot; {ep.label}</span>
          <span className="rounded-full border border-[#ece8dc]/25 px-3 py-1 text-[11px] text-[#ece8dc]/70">Illustration</span>
        </div>

        <div key={frameKey} className="demo mt-4 grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <ul role="img" aria-label={spoken} className="flex flex-col">
            {NAMES.map((name, i) => {
              let seen = 0;
              const strokes = ep.votes.flatMap((v, at) => (v === i ? [{ n: seen++, at }] : []));
              const banished = finish[0] === i;
              return (
                <li key={name} aria-hidden="true" className="relative flex h-10 items-center gap-3">
                  <span className="chalk-text w-14 shrink-0 text-lg">{name}</span>
                  <svg viewBox="-4 0 80 24" className="h-6 w-20 overflow-visible">
                    {strokes.map((s) => (
                      <path
                        key={s.n}
                        d={mark(s.n)}
                        pathLength={1}
                        className="chalk-stroke"
                        style={delay(FIRST_VOTE + s.at * VOTE_STEP)}
                      />
                    ))}
                  </svg>
                  {banished && (
                    <>
                      <svg viewBox="0 0 160 40" className="pointer-events-none absolute -inset-x-2 -inset-y-1 h-12 w-40 overflow-visible">
                        <path
                          d="M16 24 C 4 4, 150 0, 154 18 C 158 36, 18 42, 2 26 C -4 18, 24 8, 50 8"
                          pathLength={1}
                          className="chalk-stroke chalk-circle"
                          style={delay(done + 200)}
                        />
                      </svg>
                      <span className="chalk-text chalk-in ml-auto text-xs tracking-[0.2em] text-[#f2b8a8] uppercase" style={delay(done + 900)}>
                        Banished
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          <div aria-hidden="true" className="chalk-in self-start rounded-xl border border-[#ece8dc]/20 bg-black/15 p-3" style={delay(done + 1100)}>
            <p className="text-[10px] font-bold tracking-[0.2em] text-[#ece8dc]/60 uppercase">Your sealed slate</p>
            <ol className="mt-2 flex flex-col gap-1.5">
              {ep.picks.map((p, i) => (
                <li key={p} className="flex items-center gap-2 text-sm">
                  <span className="flex size-5 items-center justify-center rounded-full bg-[#ece8dc] text-[11px] font-bold text-[#17231d]">{i + 1}</span>
                  <span className="flex-1">{NAMES[p]}</span>
                  <span className={`chalk-in font-semibold tabular-nums ${points[i] ? "text-[#f3d98b]" : "text-[#ece8dc]/40"}`} style={delay(done + 1500 + i * 250)}>
                    {points[i] ? `+${points[i]}` : "0"}
                  </span>
                </li>
              ))}
            </ol>
            <p className="chalk-in mt-2 border-t border-[#ece8dc]/15 pt-2 text-sm" style={delay(done + 2300)}>
              <span className="font-semibold text-[#f3d98b] tabular-nums">+{total}</span> points this round table
            </p>
          </div>
        </div>
        {!still && <DemoPause paused={paused} onToggle={toggle} className="absolute right-1 bottom-1" />}
      </div>
    </figure>
  );
}
