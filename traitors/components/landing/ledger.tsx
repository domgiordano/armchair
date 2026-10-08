import { BANISHED, FACTION, NIGHT, placeWorth, WINNER } from "@/lib/points";

import styles from "./landing.module.css";

// The confirmed points table, from docs/features/traitors/PLAN.md and lib/points.ts.
const ROWS = [
  { call: "Your first pick is the one banished", points: `${BANISHED}` },
  { call: "Your second pick finishes exactly second", points: "3" },
  { call: "Your third pick finishes exactly third", points: "2" },
  { call: "A pick in the top three, wrong slot", points: "1" },
  { call: "You name the murder victim", points: `${NIGHT}` },
  { call: "You name the recruit", points: `${NIGHT}` },
  { call: "Your 1st-choice winner wins", points: `${WINNER} × early` },
  { call: "Your 2nd or 3rd choice wins", points: `${placeWorth(1, 1).winner} or ${placeWorth(2, 1).winner} × early` },
  { call: "Their faction too, Faithful or Traitor", points: `+${FACTION}, ${placeWorth(1, 1).faction} or ${placeWorth(2, 1).faction} × early` },
];

// How much of the season is left to air, as the candle that measures it.
const CANDLES = [
  { label: "Before the premiere", early: 1 },
  { label: "Halfway through", early: 0.5 },
  { label: "Near the end", early: 0.2 },
];

/** How points are scored, set as a ledger, with the early multiplier as a candle burning down. */
export function Ledger() {
  return (
    <div className={styles.ledger}>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Points for each call</caption>
        <thead>
          <tr className="border-b border-gilt/40">
            <th scope="col" className="pb-3 font-display text-xs font-semibold tracking-[0.2em] text-ash uppercase">
              The call
            </th>
            <th scope="col" className="pb-3 text-right font-display text-xs font-semibold tracking-[0.2em] text-ash uppercase">
              Points
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.call} className="border-b border-bone/10 last:border-0">
              <th scope="row" className="py-3 pr-4 font-normal text-parchment">
                {r.call}
              </th>
              <td className="py-3 text-right font-display text-lg font-semibold whitespace-nowrap text-candle tabular-nums">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 border-t border-gilt/30 pt-6">
        <p className="leading-relaxed">
          <span className="text-bone">Early</span> is the share of the season still to air when you seal each winner place. A
          Traitor you back 1st before the premiere who goes on to win is worth {WINNER + FACTION}; the same call halfway through,{" "}
          {(WINNER + FACTION) / 2}.
        </p>
        <ul className="mt-5 grid grid-cols-3 gap-3" aria-label="The early multiplier">
          {CANDLES.map((c) => (
            <li key={c.label} className="flex flex-col items-center justify-end gap-2 text-center">
              <span aria-hidden="true" className={styles.candle} style={{ height: `${12 + 52 * c.early}px` }}>
                <span className={styles.candleFlame} />
              </span>
              <span className="font-display text-lg font-semibold text-candle tabular-nums">×{c.early}</span>
              <span className="text-sm text-ash">{c.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm leading-relaxed text-ash">A call on something that doesn&rsquo;t happen scores nothing and costs nothing.</p>
      </div>
    </div>
  );
}
