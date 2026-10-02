import type { CSSProperties } from "react";

// Small live illustrations for the feature grid. Everything here is invented:
// no real couples, judges, users or scores. Base styles are the end state, so
// reduced motion shows each one finished and still.

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

export function BlindArt() {
  return (
    <div className="flex h-full flex-col justify-center gap-5 px-5">
      <div className="flex items-end justify-center gap-3">
        {["Judges", "Your group", "Everyone"].map((who, i) => (
          <div key={who} className="flex flex-col items-center gap-1.5">
            <span
              className="art-peek flex h-11 w-10 items-center justify-center rounded-lg border border-dashed border-muted/40 text-lg font-bold text-muted/70"
              style={delay(i * 400)}
            >
              ?
            </span>
            <span className="text-[10px] tracking-wide text-muted">{who}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1">
        {[4, 5, 6, 7, 8, 9, 10].map((n) => (
          <span
            key={n}
            className={`flex size-7 items-center justify-center rounded-md text-xs font-bold tabular-nums ${
              n === 8 ? "art-bob bg-gold text-night shadow-lg shadow-gold/30" : "border border-line text-muted"
            }`}
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

const DESK = [
  { who: "You", v: "8", face: "bg-linear-to-br from-blue via-magenta to-orange text-text" },
  { who: "Judge 1", v: "8", face: "bg-text text-night" },
  { who: "Judge 2", v: "7", face: "bg-text text-night" },
  { who: "Judge 3", v: "8", face: "bg-text text-night" },
  { who: "Group", v: "7.5", face: "border-2 border-violet bg-night text-text" },
  { who: "All", v: "7.4", face: "border-2 border-gold/80 bg-night text-gold" },
];

export function RevealArt() {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
        {DESK.map((d, i) => (
          <div key={d.who} className="flex flex-col items-center gap-1.5">
            <div className="relative h-12 w-10 [perspective:400px]">
              {i === 0 ? (
                // Your paddle is always up first; only the others turn over.
                <span className={`absolute inset-0 flex items-center justify-center rounded-lg text-sm font-extrabold ${d.face}`}>{d.v}</span>
              ) : (
                <div className="art-flip absolute inset-0" style={delay(300 + i * 140)}>
                  <span className="art-face flex items-center justify-center rounded-lg border border-line bg-night-2 text-sm font-bold text-muted">
                    ?
                  </span>
                  <span className={`art-face art-back flex items-center justify-center rounded-lg text-sm font-extrabold tabular-nums ${d.face}`}>
                    {d.v}
                  </span>
                </div>
              )}
            </div>
            <span className="text-[10px] whitespace-nowrap text-muted">{d.who}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const BOARD = [
  { name: "Priya", gap: "0.4", you: false },
  { name: "You", gap: "0.6", you: true },
  { name: "Marcus", gap: "0.9", you: false },
];

export function AccuracyArt() {
  return (
    <div className="grid h-full grid-cols-[1fr_auto] items-center gap-4 px-5">
      <svg viewBox="0 0 120 80" className="h-auto w-full" aria-hidden="true">
        <path d="M4 72h112" className="stroke-line" strokeWidth="1.5" />
        <path
          d="M6 14 L26 40 L46 28 L66 48 L86 52 L110 62"
          pathLength={1}
          className="art-draw stroke-orange"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
        <text x="6" y="8" fontSize="8" className="fill-muted" fontWeight="600">
          Your gap to the panel
        </text>
      </svg>
      <ol className="w-32 space-y-1.5">
        {BOARD.map((r, i) => (
          <li
            key={r.name}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${r.you ? "bg-violet/25 text-text" : "text-muted"}`}
          >
            <span className="w-3 font-bold tabular-nums">{i + 1}</span>
            <span className="flex-1 font-medium">{r.name}</span>
            <span className="tabular-nums">&plusmn;{r.gap}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const CREW = [
  { initials: "SK", tone: "bg-blue" },
  { initials: "JR", tone: "bg-magenta" },
  { initials: "AL", tone: "bg-orange" },
  { initials: "MT", tone: "bg-violet" },
];

export function GroupArt() {
  return (
    <div className="flex h-full flex-col justify-center gap-4 px-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Tuesday Couch Crew</p>
          <p className="text-[11px] text-muted">4 members &middot; joined by invite link</p>
        </div>
        <div className="flex -space-x-2">
          {CREW.map((m, i) => (
            <span
              key={m.initials}
              style={delay(i * 150)}
              className={`art-wave flex size-8 items-center justify-center rounded-full border-2 border-night-2 text-[10px] font-bold text-text ${m.tone}`}
            >
              {m.initials}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[
          { show: "Dancing with the Stars", live: true },
          { show: "The Traitors", live: true },
          { show: "Survivor", live: false },
        ].map((s) => (
          <span
            key={s.show}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
              s.live ? "border-gold/60 text-gold" : "border-line text-muted"
            }`}
          >
            {s.show}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SeasonsArt() {
  const seasons = Array.from({ length: 14 }, (_, i) => 35 - i);
  return (
    <div className="flex h-full flex-col justify-center gap-3 overflow-hidden px-5">
      <div className="[mask-image:linear-gradient(90deg,#000_65%,transparent)]">
        <div className="art-pan flex gap-1.5">
          {seasons.map((s) => (
            <span
              key={s}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums ${
                s === 35 ? "bg-text text-night" : "border border-line text-muted"
              }`}
            >
              S{s}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-line bg-night/60 px-3 py-2.5">
        <span className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md bg-gold text-sm font-extrabold text-night">9</span>
        <p className="text-xs leading-snug text-muted">
          <span className="font-semibold text-text">Season 1 &middot; Week 4 &middot; Couple 2</span>
          <br />
          Judges&rsquo; scores already in. Yours goes up first.
        </p>
      </div>
    </div>
  );
}

export function VoteArt() {
  return (
    <div className="flex h-full flex-col justify-center gap-3 px-5">
      <p className="flex items-center gap-2 text-xs font-semibold text-text">
        <span className="size-2 rounded-full bg-magenta motion-safe:animate-pulse" aria-hidden="true" />
        Voting is open until the broadcast ends
      </p>
      {[
        { couple: "Couple 1", votes: 10 },
        { couple: "Couple 4", votes: 6 },
      ].map((c, i) => (
        <div key={c.couple} className="flex items-center gap-3">
          <span className="w-16 text-xs text-muted">{c.couple}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
            <span
              className="art-fill block h-full rounded-full bg-linear-to-r from-blue to-magenta"
              style={{ width: `${c.votes * 10}%`, ...delay(i * 300) }}
            />
          </span>
          <span className="w-10 text-right text-xs font-semibold tabular-nums">{c.votes}/10</span>
        </div>
      ))}
    </div>
  );
}
