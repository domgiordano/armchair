import { TartanBand } from "@/components/ui/tartan-band";

import { Reveal } from "./reveal";
import styles from "./landing.module.css";

// Invented players and scores.
const BOARD = [
  { name: "Rhona", points: 112 },
  { name: "You", points: 97 },
  { name: "Callum", points: 85 },
  { name: "Ailsa", points: 61 },
  { name: "Euan", points: 44 },
];
const TOP = BOARD[0].points;

/** A group's leaderboard, as a preview: gilt bars on a tartan runner. */
export function Friends() {
  return (
    <Reveal className={styles.board}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-display text-xs font-semibold tracking-[0.2em] text-ash uppercase">The Thursday lot · New Blood</p>
        <p className="font-display text-xs font-semibold tracking-[0.2em] text-ash uppercase">Points</p>
      </div>
      <TartanBand className="mt-3" />
      <ol className="mt-3 flex flex-col">
        {BOARD.map((p, i) => (
          <li key={p.name} className="grid grid-cols-[2rem_6rem_1fr_3rem] items-center gap-3 border-b border-bone/10 py-3 last:border-0">
            <span className="font-display text-sm text-gilt tabular-nums">{i + 1}</span>
            <span className={p.name === "You" ? "font-semibold text-bone" : "text-parchment"}>{p.name}</span>
            <span className="h-2 overflow-hidden rounded-full bg-cloak">
              <span
                className={`${styles.bar} block h-full rounded-full bg-[linear-gradient(90deg,var(--gilt),var(--flame))]`}
                style={{ width: `${(p.points / TOP) * 100}%`, animationDelay: `${200 + i * 120}ms` }}
              />
            </span>
            <span className="text-right font-display font-semibold text-candle tabular-nums">{p.points}</span>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}
