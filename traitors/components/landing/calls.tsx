import { Seal } from "@/components/ui/wax-seal";

import { Reveal } from "./reveal";
import styles from "./landing.module.css";

/** How many season winners you may back. */
export const WINNERS = 3;

const WORDS = ["none", "one", "two", "three"];

const CARD = "relative flex h-full flex-col gap-3 rounded-sm border border-gilt/30 bg-stone/80 p-6";

/** The four kinds of call, each in the object the show would use for it. */
export function Calls() {
  return (
    <div className="mt-12 grid gap-5 md:grid-cols-2">
      <Reveal className="md:row-span-2">
        <div className={`${CARD} ${styles.slateCard}`}>
          <p className="font-display text-xs font-semibold tracking-[0.2em] text-candle uppercase">Every round table</p>
          <h3 className="font-display text-2xl font-semibold text-bone">The slate: your top three</h3>
          <p className="leading-relaxed">
            Rank the three players you think draw the most votes. Your first pick is who you think is banished; the second and
            third say who comes next.
          </p>
          <ol className="mt-3 flex flex-col gap-1 rounded-sm border-4 border-gilt bg-[linear-gradient(160deg,#26302b,#1a211d_60%,var(--stone))] p-5 shadow-[inset_0_0_30px_rgb(0_0_0/0.6)]">
            {[
              ["I", "Morag"],
              ["II", "Fergus"],
              ["III", "Isla"],
            ].map(([rank, name], i) => (
              <li key={rank} className="flex items-baseline gap-4 border-b border-bone/10 py-1.5 last:border-0">
                <span className="w-8 font-display text-sm text-gilt">{rank}</span>
                <span className={`${styles.chalkIn} font-hand text-3xl text-bone/90`} style={{ animationDelay: `${300 + i * 350}ms` }}>
                  {name}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-ash">Names on these pages are made up.</p>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className={CARD}>
          <Envelope />
          <p className="font-display text-xs font-semibold tracking-[0.2em] text-candle uppercase">Every night</p>
          <h3 className="font-display text-2xl font-semibold text-bone">The murder</h3>
          <p className="leading-relaxed">Name the player who won&rsquo;t come down to breakfast. One name, sealed.</p>
        </div>
      </Reveal>

      <Reveal delay={200}>
        <div className={CARD}>
          <Cloak />
          <p className="font-display text-xs font-semibold tracking-[0.2em] text-candle uppercase">If you smell it coming</p>
          <h3 className="font-display text-2xl font-semibold text-bone">The recruit</h3>
          <p className="leading-relaxed">
            Think the Traitors will offer someone a cloak? Name them. It&rsquo;s optional, and if nobody is recruited it simply
            doesn&rsquo;t count.
          </p>
        </div>
      </Reveal>

      <Reveal delay={150} className="md:col-span-2">
        <div className={`${CARD} md:flex-row md:items-center md:gap-8`}>
          <Seal className="size-20 shrink-0 -rotate-12 drop-shadow-[0_8px_12px_rgb(0_0_0/0.6)]" />
          <div className="flex flex-col gap-3">
            <p className="font-display text-xs font-semibold tracking-[0.2em] text-candle uppercase">Once a season</p>
            <h3 className="font-display text-2xl font-semibold text-bone">The winners</h3>
            <p className="leading-relaxed">
              Rank your top {WORDS[WINNERS]} winners, and say whether each wins as a Faithful or a Traitor. Your 1st choice
              earns the most if they win, your 2nd 60% of that, your 3rd 30%. It&rsquo;s the first thing you do in a season,
              and it&rsquo;s worth the most: seal it before the premiere for full points, because every episode that airs
              first takes a share off.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/** A folded note under red wax. */
function Envelope() {
  return (
    <svg viewBox="0 0 120 60" aria-hidden="true" className="h-14 w-28">
      <rect x="6" y="8" width="108" height="46" rx="2" fill="#e8dcc0" />
      <path d="M6 10 L60 38 L114 10" fill="none" stroke="#b9a47c" strokeWidth="2" />
      <circle cx="60" cy="38" r="11" fill="var(--blood)" stroke="var(--oxblood)" strokeWidth="2" />
      <circle cx="60" cy="38" r="6" fill="none" stroke="var(--oxblood)" strokeWidth="1.5" />
    </svg>
  );
}

/** A green cloak held open, hood and all. */
function Cloak() {
  return (
    <svg viewBox="0 0 120 60" aria-hidden="true" className="h-14 w-28">
      <path d="M60 4 C48 6 42 16 41 26 C34 30 20 34 12 56 L108 56 C100 34 86 30 79 26 C78 16 72 6 60 4 Z" fill="var(--cloak-500)" />
      <path d="M60 12 C53 13 50 19 50 25 C50 31 54 35 60 37 C66 35 70 31 70 25 C70 19 67 13 60 12 Z" fill="#050806" />
      <path d="M60 37 L60 56" stroke="#0d2418" strokeWidth="3" />
      <path d="M12 56 C20 34 34 30 41 26" fill="none" stroke="var(--gilt)" strokeOpacity="0.6" strokeWidth="1.5" />
    </svg>
  );
}
