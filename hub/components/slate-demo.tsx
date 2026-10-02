// Invented. No real players, seasons or results.
const TOP_3 = ["Wren", "Otis", "Mara"];
const NIGHT = [
  { label: "Murder", pick: "Jules" },
  { label: "Recruit", pick: "No one" },
];

/** The Traitors' ballot, as a still: the round-table top 3 and the night's picks, sealed. */
export function SlateDemo() {
  const spoken = `The Traitors, episode 4. Your round table top 3: ${TOP_3.join(", ")}. Murder: Jules. Recruit: no one. Sealed until the episode airs.`;
  return (
    <figure className="rounded-3xl border border-[#1c3a2a] bg-linear-to-br from-[#0b2418] to-[#040d08] p-4 text-[#e9dcc0] shadow-2xl shadow-night sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tracking-[0.18em] uppercase">The Traitors &middot; Episode 4</span>
        <span className="rounded-full border border-[#e9dcc0]/25 px-3 py-1 text-[11px] text-[#e9dcc0]/70">
          Illustration &middot; invented names
        </span>
      </div>
      <div role="img" aria-label={spoken} className="mt-4 grid grid-cols-[1.2fr_1fr] gap-4">
        <div aria-hidden="true">
          <p className="text-[10px] font-bold tracking-[0.2em] text-[#e9dcc0]/60 uppercase">Round table</p>
          <ol className="mt-2 flex flex-col gap-1.5">
            {TOP_3.map((name, i) => (
              <li key={name} className="flex items-center gap-2 rounded-lg border border-[#e9dcc0]/15 bg-[#040d08]/60 px-2.5 py-1.5 text-sm">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#e9dcc0] text-[11px] font-bold text-[#0b2418]">
                  {i + 1}
                </span>
                {name}
              </li>
            ))}
          </ol>
        </div>
        <div aria-hidden="true">
          <p className="text-[10px] font-bold tracking-[0.2em] text-[#e9dcc0]/60 uppercase">The night</p>
          <dl className="mt-2 flex flex-col gap-1.5">
            {NIGHT.map((n) => (
              <div key={n.label} className="rounded-lg border border-[#e9dcc0]/15 bg-[#040d08]/60 px-2.5 py-1.5">
                <dt className="text-[10px] tracking-wide text-[#e9dcc0]/60">{n.label}</dt>
                <dd className="text-sm">{n.pick}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-[#e9dcc0]/75">
        <span aria-hidden="true" className="size-3 shrink-0 rounded-full bg-linear-to-br from-[#c2412d] to-[#7a1d12]" />
        Sealed. Nobody else&rsquo;s picks show until yours are in.
      </p>
    </figure>
  );
}
