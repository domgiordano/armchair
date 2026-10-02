"use client";

import { DemoPause } from "@/components/demo-pause";
import { useCycle } from "@/lib/use-cycle";

// Invented. No real people or scores.
const PEOPLE = [
  { id: "you", name: "You", initials: "YO" },
  { id: "priya", name: "Priya", initials: "PR" },
  { id: "marcus", name: "Marcus", initials: "MA" },
  { id: "jo", name: "Jo", initials: "JO" },
];

interface Board {
  show: string;
  metric: string;
  /** Lower wins on DWTS (points off the judges); higher wins on The Traitors (points). */
  lowerWins: boolean;
  values: Record<string, number>;
  format: (n: number) => string;
}

const BOARDS: Board[] = [
  {
    show: "Dancing with the Stars",
    metric: "Points off the judges",
    lowerWins: true,
    values: { you: 0.55, priya: 0.42, marcus: 0.71, jo: 0.93 },
    format: (n) => `±${n.toFixed(2)}`,
  },
  {
    show: "The Traitors",
    metric: "Points",
    lowerWins: false,
    values: { you: 31, priya: 24, marcus: 19, jo: 38 },
    format: (n) => String(n),
  },
];
const CYCLE_MS = 4500;
const ROW = 52;

/** One group's board, switching between shows: the same crew, ranked by each show's own measure. */
export function LeagueDemo() {
  const { ref, index, still, paused, toggle } = useCycle<HTMLElement>(BOARDS.length, CYCLE_MS);
  const board = BOARDS[index];
  const ranked = [...PEOPLE].sort((a, b) => (board.values[a.id] - board.values[b.id]) * (board.lowerWins ? 1 : -1));
  const spoken = `Tuesday Couch Crew, ${board.show}, ${board.metric}: ${ranked.map((p, i) => `${i + 1} ${p.name} ${board.format(board.values[p.id])}`).join(", ")}.`;

  return (
    <figure ref={ref} className="relative rounded-3xl border border-line bg-night-2/80 p-5 shadow-2xl shadow-violet/10 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Tuesday Couch Crew</p>
          <p className="text-xs text-muted">4 members &middot; joined by invite link</p>
        </div>
        <span className="rounded-full border border-line px-3 py-1 text-[11px] text-muted">Illustration</span>
      </div>
      <div className="mt-4 flex gap-1 rounded-full border border-line p-1 text-xs font-semibold" aria-hidden="true">
        {BOARDS.map((b, i) => (
          <span
            key={b.show}
            className={`flex-1 rounded-full px-3 py-1.5 text-center transition-colors duration-500 motion-reduce:transition-none ${
              i === index ? "bg-text text-night" : "text-muted"
            }`}
          >
            {b.show}
          </span>
        ))}
      </div>
      <p className="mt-4 text-[11px] font-semibold tracking-[0.2em] text-muted uppercase" aria-hidden="true">
        {board.metric}
      </p>
      <ol role="img" aria-label={spoken} className="relative mt-2" style={{ height: ROW * PEOPLE.length }}>
        {PEOPLE.map((p) => {
          const rank = ranked.indexOf(p);
          const you = p.id === "you";
          return (
            <li
              key={p.id}
              aria-hidden="true"
              style={{ transform: `translateY(${rank * ROW}px)`, height: ROW - 6 }}
              className={`absolute inset-x-0 top-0 flex items-center gap-3 rounded-2xl px-3 transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.3,1)] motion-reduce:transition-none ${
                you ? "bg-violet/25 ring-1 ring-violet/60" : "bg-night/60"
              }`}
            >
              <span className="w-4 text-sm font-bold text-muted tabular-nums">{rank + 1}</span>
              <span
                className={`flex size-8 items-center justify-center rounded-full text-[11px] font-bold ${
                  you ? "bg-linear-to-br from-blue via-magenta to-orange text-text" : "bg-line text-text"
                }`}
              >
                {p.initials}
              </span>
              <span className="flex-1 text-sm font-medium">{p.name}</span>
              <span className="text-sm font-semibold tabular-nums">{board.format(board.values[p.id])}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Filter any reveal or leaderboard down to the group.</p>
        {!still && <DemoPause paused={paused} onToggle={toggle} className="-mr-2 shrink-0" />}
      </div>
    </figure>
  );
}
