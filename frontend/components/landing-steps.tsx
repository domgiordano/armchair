import type { ReactNode } from "react";

interface Step {
  title: string;
  body: string;
  diagram: ReactNode;
}

// Diagrams share a 160x88 box: silver line work, gold for the thing the step is about.
const LINE = "stroke-silver-dim/70";

const STEPS: Step[] = [
  {
    title: "Pick the couple",
    body: "When a couple takes the floor, tap their card. Cards stay alphabetical, so the order never spoils who danced.",
    diagram: (
      <>
        {[10, 34, 58].map((y, i) => (
          <g key={y}>
            <rect
              x="20"
              y={y}
              width="120"
              height="20"
              rx="5"
              className={i === 1 ? "fill-gold/15 stroke-gold" : `fill-none ${LINE}`}
              strokeWidth="1.5"
            />
            <circle cx="33" cy={y + 10} r="5" className={i === 1 ? "fill-gold" : "fill-silver-dim/40"} />
            <rect x="44" y={y + 7} width={i === 1 ? 56 : 44} height="6" rx="3" className={i === 1 ? "fill-gold-light" : "fill-silver-dim/40"} />
          </g>
        ))}
      </>
    ),
  },
  {
    title: "Hold up your paddle",
    body: "Score them 1 to 10 while they dance. Once you submit it's final, and nobody's scores show until yours is in.",
    diagram: (
      <>
        <rect x="58" y="6" width="44" height="38" rx="5" className="fill-gold stroke-gold-deep" strokeWidth="2" />
        <text x="80" y="33" textAnchor="middle" className="fill-ink text-[22px] font-extrabold">
          8
        </text>
        <rect x="78.5" y="44" width="3" height="18" rx="1" className="fill-silver-dim" />
        {Array.from({ length: 10 }, (_, i) => (
          <circle key={i} cx={26 + i * 12} cy="76" r="3.5" className={i === 7 ? "fill-gold" : "fill-silver-dim/40"} />
        ))}
      </>
    ),
  },
  {
    title: "Reveal the desk",
    body: "Then the desk turns over: the judges' paddles, yours, your friends' and the room's average, side by side.",
    diagram: (
      <>
        {[
          { x: 24, y: 18, you: false },
          { x: 56, y: 12, you: false },
          { x: 88, y: 22, you: true },
          { x: 120, y: 16, you: false },
        ].map((p) => (
          <g key={p.x}>
            <rect x={p.x + 7.5} y={p.y + 18} width="3" height={60 - p.y} className="fill-silver-dim" />
            <rect
              x={p.x}
              y={p.y}
              width="18"
              height="18"
              rx="3"
              className={p.you ? "fill-gold stroke-gold-deep" : "fill-silver stroke-gold-deep"}
              strokeWidth="1.5"
            />
          </g>
        ))}
        <rect x="14" y="66" width="132" height="14" rx="2" className="fill-ballroom stroke-gold/70" strokeWidth="1.5" />
      </>
    ),
  },
  {
    title: "Track your accuracy",
    body: "Every score is measured against the judges. Watch your average gap shrink as the season goes on.",
    diagram: (
      <>
        <line x1="18" x2="146" y1="74" y2="74" className={LINE} strokeWidth="1.5" strokeDasharray="3 4" />
        <polyline
          points="22,20 50,34 78,30 106,50 138,62"
          className="fill-none stroke-silver"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {[
          [22, 20],
          [50, 34],
          [78, 30],
          [106, 50],
        ].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="3.5" className="fill-silver" />
        ))}
        <circle cx="138" cy="62" r="5" className="fill-gold" />
      </>
    ),
  },
];

/** "How it works": four beats of a show night, each with a small diagram. */
export function LandingSteps() {
  return (
    <ol className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((s, i) => (
        <li
          key={s.title}
          className="flex flex-col gap-3 rounded-xl border border-silver/10 bg-ballroom/40 p-5 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-gold/30"
        >
          <svg viewBox="0 0 160 88" aria-hidden="true" className="w-full max-w-60">
            {s.diagram}
          </svg>
          <p className="font-display text-sm text-gold">{String(i + 1).padStart(2, "0")}</p>
          <h3 className="-mt-2 text-lg font-semibold text-silver">{s.title}</h3>
          <p className="text-sm leading-relaxed text-silver-dim">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
