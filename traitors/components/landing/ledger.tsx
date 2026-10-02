import styles from "./landing.module.css";

// The confirmed points table, from docs/features/traitors/PLAN.md.
const ROWS = [
  { call: "Your first pick is the one banished", points: "5" },
  { call: "Your second pick finishes exactly second", points: "3" },
  { call: "Your third pick finishes exactly third", points: "2" },
  { call: "A pick in the top three, wrong slot", points: "1" },
  { call: "You name the murder victim", points: "4" },
  { call: "You name the recruit", points: "4" },
  { call: "A winner, per correct pick", points: "20 × early" },
  { call: "Their faction too, Faithful or Traitor", points: "+10 × early" },
];

/** How points are scored, set as a ledger. */
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
      <p className="mt-5 text-sm leading-relaxed text-ash">
        <span className="text-parchment">Early</span> is the share of the season still to air when you lock your winners: ×1 before the
        premiere, ×0.5 halfway through. A call on something that doesn&rsquo;t happen scores nothing and costs nothing.
      </p>
    </div>
  );
}
