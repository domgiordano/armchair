import styles from "./landing.module.css";

// Invented names: an illustration, not anyone's ballot.
const RANKS = [
  { rank: "I", name: "Morag" },
  { rank: "II", name: "Fergus" },
  { rank: "III", name: "Isla" },
];

/** A chalked slate ballot, the way the show's players vote, sealed at the bottom. */
export function Slate() {
  return (
    <figure className="relative mx-auto w-full max-w-sm">
      <div className={styles.slate}>
        <p className="font-display text-xs font-semibold tracking-[0.2em] text-ash uppercase">Episode 6 · your ballot</p>

        <h3 className="mt-5 font-display text-sm tracking-[0.14em] text-bone uppercase">The round table</h3>
        <ol className="mt-2 flex flex-col gap-1">
          {RANKS.map((r) => (
            <li key={r.rank} className="flex items-baseline gap-4 border-b border-bone/10 py-1.5">
              <span className="w-8 font-display text-sm text-gilt">{r.rank}</span>
              <span className={`${styles.chalk} font-hand text-3xl`}>{r.name}</span>
            </li>
          ))}
        </ol>

        <dl className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <dt className="font-display text-sm tracking-[0.14em] text-bone uppercase">Murdered</dt>
            <dd className={`${styles.chalk} font-hand text-3xl`}>Hamish</dd>
          </div>
          <div>
            <dt className="font-display text-sm tracking-[0.14em] text-bone uppercase">Recruited</dt>
            <dd className={`${styles.chalk} font-hand text-3xl`}>Elspeth</dd>
          </div>
        </dl>

        <Seal />
      </div>
      <figcaption className="mt-3 text-center text-sm text-ash italic">An example ballot. The names are made up.</figcaption>
    </figure>
  );
}

/** Red wax, pressed with a hood of our own: the mark of a locked pick. */
function Seal() {
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true" className={styles.seal}>
      <path
        d="M40 3 C47 3 50 8 56 9 C63 10 68 13 70 20 C72 26 77 30 77 37 C77 44 73 48 72 55 C70 62 65 67 58 70 C52 72 48 77 40 77 C32 77 28 72 21 70 C14 67 10 62 8 55 C7 48 3 44 3 37 C3 30 8 26 10 20 C12 13 17 10 24 9 C30 8 33 3 40 3 Z"
        fill="var(--blood)"
      />
      <circle cx="40" cy="40" r="25" fill="none" stroke="var(--oxblood)" strokeWidth="3" />
      <path d="M40 22 C33 23 29 30 28.5 38 C28 46 26 51 23 56 L57 56 C54 51 52 46 51.5 38 C51 30 47 23 40 22 Z" fill="var(--oxblood)" />
      <path d="M40 31 C36 31.5 34.5 35 34.5 39 C34.5 44 37 47 40 48.5 C43 47 45.5 44 45.5 39 C45.5 35 44 31.5 40 31 Z" fill="var(--blood)" />
    </svg>
  );
}
