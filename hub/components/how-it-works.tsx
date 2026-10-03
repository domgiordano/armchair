import type { ReactNode } from "react";

import { reveal } from "@/lib/reveal";

interface Step {
  title: string;
  body: string;
  diagram: ReactNode;
}

const svg = "h-auto w-full";
const label = { fontFamily: "var(--font-poppins), sans-serif", fontWeight: 700 } as const;

const STEPS: Step[] = [
  {
    title: "Watch it your way",
    body: "Live on the night or on replay days later. Nothing is spoiled until you get there.",
    diagram: (
      <svg viewBox="0 0 160 100" className={svg} aria-hidden="true">
        <rect x="22" y="12" width="116" height="66" rx="10" className="fill-night stroke-line" strokeWidth="2" />
        <path d="M72 34v24l20-12z" className="fill-magenta" />
        <path d="M66 90h28M80 78v12" className="stroke-muted" strokeWidth="2" strokeLinecap="round" />
        <rect x="30" y="20" width="26" height="11" rx="5.5" className="fill-magenta/20" />
        <text x="43" y="28.5" textAnchor="middle" fontSize="7" className="fill-magenta" style={label}>
          LIVE
        </text>
        <circle cx="126" cy="66" r="15" className="fill-night-2 stroke-blue" strokeWidth="2" />
        <path d="M126 58v8l5 4" className="stroke-blue" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    title: "Make your call, blind",
    body: "A paddle from 1 to 10 for each dance, or your round table top 3 and the night's murder and recruit. Once it's in, it's final.",
    diagram: (
      <svg viewBox="0 0 160 100" className={svg} aria-hidden="true">
        <rect x="16" y="14" width="34" height="38" rx="8" className="fill-gold" />
        <text x="33" y="39" textAnchor="middle" fontSize="18" className="fill-night" style={label}>
          8
        </text>
        <path d="M33 52v18" className="stroke-muted" strokeWidth="3" strokeLinecap="round" />
        <rect x="72" y="10" width="74" height="64" rx="8" className="fill-night stroke-line" strokeWidth="2" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <circle cx="84" cy={26 + i * 18} r="6" className="fill-text" />
            <text x="84" y={29 + i * 18} textAnchor="middle" fontSize="8" className="fill-night" style={label}>
              {i + 1}
            </text>
            <rect x="96" y={23 + i * 18} width={40 - i * 8} height="6" rx="3" className="fill-muted/60" />
          </g>
        ))}
        <text x="33" y="90" textAnchor="middle" fontSize="7" className="fill-muted" style={label}>
          EACH DANCE
        </text>
        <text x="109" y="90" textAnchor="middle" fontSize="7" className="fill-muted" style={label}>
          ROUND TABLE
        </text>
      </svg>
    ),
  },
  {
    title: "Then the reveal",
    body: "Only after you call it: the judges' scores or the round table's verdict, beside your group's calls and the whole crowd's.",
    diagram: (
      <svg viewBox="0 0 160 100" className={svg} aria-hidden="true">
        {[
          { x: 18, v: "8", c: "fill-magenta", t: "fill-text" },
          { x: 64, v: "7", c: "fill-text", t: "fill-night" },
          { x: 110, v: "8", c: "fill-text", t: "fill-night" },
        ].map((p) => (
          <g key={p.x}>
            <rect x={p.x} y="14" width="32" height="38" rx="8" className={p.c} />
            <text x={p.x + 16} y="39" textAnchor="middle" fontSize="17" className={p.t} style={label}>
              {p.v}
            </text>
            <path d={`M${p.x + 16} 52v16`} className="stroke-muted" strokeWidth="3" strokeLinecap="round" />
          </g>
        ))}
        <rect x="8" y="68" width="144" height="7" rx="3.5" className="fill-violet" />
        <text x="34" y="92" textAnchor="middle" fontSize="8" className="fill-muted" style={label}>
          YOU
        </text>
        <text x="103" y="92" textAnchor="middle" fontSize="8" className="fill-muted" style={label}>
          JUDGES
        </text>
      </svg>
    ),
  },
  {
    title: "Climb the board",
    body: "Dancing with the Stars tracks your gap to the judges; The Traitors scores points for every call that lands. Race your friends all season.",
    diagram: (
      <svg viewBox="0 0 160 100" className={svg} aria-hidden="true">
        <path d="M16 84h130" className="stroke-line" strokeWidth="2" />
        <path d="M16 60 L46 46 L76 52 L106 36 L136 30" className="stroke-muted" strokeWidth="2" strokeDasharray="4 4" fill="none" />
        <path d="M16 20 L46 70 L76 38 L106 44 L136 32" className="stroke-orange" strokeWidth="3" strokeLinejoin="round" fill="none" />
        <circle cx="136" cy="32" r="4" className="fill-orange" />
        <text x="136" y="16" textAnchor="middle" fontSize="9" className="fill-text" style={label}>
          ±0.2
        </text>
        <text x="16" y="96" fontSize="7" className="fill-muted" style={label}>
          WEEK 1
        </text>
        <text x="146" y="96" textAnchor="end" fontSize="7" className="fill-muted" style={label}>
          FINALE
        </text>
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-20 border-t border-line py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center" {...reveal()}>
          <p className="text-xs font-semibold tracking-[0.3em] text-orange uppercase">How it works</p>
          <h2 id="how-title" className="mx-auto mt-3 max-w-xl text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            Blind first. <span className="text-brand-gradient">Then the reveal.</span>
          </h2>
        </div>
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="group flex flex-col rounded-2xl border border-line bg-night-2/60 p-5 transition-colors hover:border-muted/40 motion-reduce:transition-none"
              {...reveal(i + 1)}
            >
              <div className="mx-auto w-full max-w-60 px-2 pt-1 transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-[1.03] motion-reduce:transition-none">
                {s.diagram}
              </div>
              <p className="mt-5 text-xs font-semibold tracking-[0.2em] text-muted tabular-nums">0{i + 1}</p>
              <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
