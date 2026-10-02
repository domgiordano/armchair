import type { CSSProperties } from "react";

import { Seal } from "@/components/ui/wax-seal";

import { Reveal } from "./reveal";
import styles from "./landing.module.css";

// Invented friends and picks.
const OTHERS = [
  { who: "Ailsa", pick: "Isla" },
  { who: "Callum", pick: "Fergus" },
  { who: "Rhona", pick: "Fergus" },
];

/**
 * Blind until you call it, played out: everyone else's pick lies sealed and
 * face down until yours is stamped, then they turn over.
 */
export function Blind() {
  return (
    <Reveal>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <li className={`${styles.pickCard} ${styles.mine}`}>
          <p className="font-display text-xs font-semibold tracking-[0.18em] text-ash uppercase">You</p>
          <p className="font-hand text-3xl text-bone">Fergus</p>
          <Seal className={`${styles.stamp} absolute -right-3 -bottom-3 size-12`} />
        </li>
        {OTHERS.map((o, i) => (
          <li key={o.who} className={styles.flip} style={{ "--flip": `${1100 + i * 220}ms` } as CSSProperties}>
            <div aria-hidden="true" className={`${styles.pickCard} ${styles.back}`}>
              <p className="font-display text-xs font-semibold tracking-[0.18em] text-ash uppercase">{o.who}</p>
              <Seal className="size-12" />
            </div>
            <div className={`${styles.pickCard} ${styles.front}`}>
              <p className="font-display text-xs font-semibold tracking-[0.18em] text-ash uppercase">{o.who}</p>
              <p className="font-hand text-3xl text-bone">{o.pick}</p>
            </div>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
