import type { CSSProperties, ReactNode } from "react";

import { reveal } from "@/components/scroll-reveals";
import { DISPLAY } from "@/lib/ui";

// Every name and number in these illustrations is invented.

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

interface SectionProps {
  id: string;
  eyebrow: string;
  title: string;
  body: ReactNode;
  points: string[];
  art: ReactNode;
  flip?: boolean;
}

function Section({ id, eyebrow, title, body, points, art, flip = false }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16 border-t border-silver/10 py-16 lg:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div className={flip ? "lg:order-last" : ""} {...reveal()}>
          <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{eyebrow}</p>
          <h2 id={`${id}-title`} className={`${DISPLAY} mt-3 text-3xl leading-none sm:text-5xl`}>
            <span className="text-chrome">{title}</span>
          </h2>
          <p className="mt-4 leading-relaxed text-silver-dim">{body}</p>
          <ul className="mt-6 flex flex-col gap-3">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-sm leading-relaxed text-silver">
                <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true">
                  <path d="m3 8.5 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <figure className="rounded-2xl border border-silver/15 bg-ballroom/60 p-5 shadow-[0_24px_80px_-32px_rgb(232_194_104/0.35)] sm:p-6" {...reveal(2)}>
          {art}
          <figcaption className="mt-5 border-t border-silver/10 pt-3 text-xs text-silver-dim">Illustration with invented names and scores.</figcaption>
        </figure>
      </div>
    </section>
  );
}

const JUDGES = [
  { name: "Marisol", gap: 0.48 },
  { name: "Theo", gap: 0.71 },
  { name: "Vivienne", gap: 0.39 },
];
const TREND = [1.4, 1.1, 1.2, 0.8, 0.7, 0.75, 0.5, 0.42];

function AccuracyArt() {
  const x = (i: number) => 8 + (i * 284) / (TREND.length - 1);
  const y = (v: number) => 10 + (1 - v / 1.5) * 70;
  const points = TREND.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <div
      role="img"
      aria-label={`Points off each judge this season: ${JUDGES.map((j) => `${j.name} ${j.gap}`).join(", ")}. Your average gap fell from 1.4 in week 1 to 0.42 in week 8.`}
    >
      <p className="text-[11px] font-semibold tracking-[0.18em] text-gold uppercase">Season 35 · points off, judge by judge</p>
      <ul className="mt-4 flex flex-col gap-3" aria-hidden="true">
        {JUDGES.map((j, i) => (
          <li key={j.name} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3 text-sm">
            <span className="text-silver">{j.name}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-silver/10">
              <span className="lx-bar block h-full rounded-full bg-linear-to-r from-gold-deep to-gold" style={{ width: `${j.gap * 100}%`, ...d(300 + i * 150) }} />
            </span>
            <span className="text-right font-semibold text-pearl tabular-nums">{j.gap.toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[11px] font-semibold tracking-[0.18em] text-silver-dim uppercase" aria-hidden="true">
        Your average gap, week by week
      </p>
      <svg viewBox="0 0 300 90" className="mt-2 w-full" aria-hidden="true">
        <line x1="8" x2="292" y1="80" y2="80" className="stroke-silver-dim/40" strokeDasharray="3 4" />
        <polyline points={points} pathLength={1} className="lx-draw fill-none stroke-gold" strokeWidth="2.5" strokeLinejoin="round" style={d(600)} />
        <circle cx={x(TREND.length - 1)} cy={y(TREND.at(-1) ?? 0)} r="5" className="lx-pop fill-gold-light" style={d(1700)} />
      </svg>
    </div>
  );
}

const WEEKS = [
  { week: "Week 4", note: "All 6 dances scored", state: "done" },
  { week: "Week 5", note: "3 dances waiting for you", state: "open" },
  { week: "Week 6", note: "Opens once week 5 is done or skipped", state: "held" },
] as const;

function CatchUpArt() {
  return (
    <ol aria-label="Catching up: week 4 scored, week 5 has 3 dances waiting, week 6 opens once week 5 is done or skipped" className="flex flex-col gap-3">
      {WEEKS.map((w, i) => (
        <li
          key={w.week}
          className={`lx-slide flex items-center gap-4 rounded-xl border p-4 ${
            w.state === "open" ? "border-gold/50 bg-gold/10" : "border-silver/10 bg-ink/40"
          }`}
          style={d(200 + i * 160)}
        >
          <span
            aria-hidden="true"
            className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              w.state === "done" ? "bg-gold text-ink" : w.state === "open" ? "border-2 border-gold text-gold-light" : "border border-silver/25 text-silver-dim"
            }`}
          >
            {w.state === "done" ? <Check /> : w.state === "open" ? "3" : <Lock />}
          </span>
          <span className="flex flex-col">
            <span className="font-semibold text-pearl">{w.week}</span>
            <span className="text-sm text-silver-dim">{w.note}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path d="m3 8.5 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Lock() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

const BOARD = [
  { name: "Priya", gap: 0.42 },
  { name: "You", gap: 0.55 },
  { name: "Marcus", gap: 0.71 },
  { name: "Jo", gap: 0.93 },
];

function BoardArt() {
  return (
    <div role="img" aria-label="Season leaderboard filtered to Tuesday Couch Crew: 1 Priya 0.42, 2 You 0.55, 3 Marcus 0.71, 4 Jo 0.93 points off the judges.">
      <div className="flex flex-wrap gap-2 text-xs font-semibold" aria-hidden="true">
        {["Everyone", "Friends", "Tuesday Couch Crew"].map((f, i) => (
          <span key={f} className={`rounded-full border px-3 py-1.5 ${i === 2 ? "border-gold bg-gold/15 text-gold-light" : "border-silver/20 text-silver-dim"}`}>
            {f}
          </span>
        ))}
      </div>
      <ol className="mt-4 flex flex-col gap-2" aria-hidden="true">
        {BOARD.map((r, i) => (
          <li
            key={r.name}
            className={`lx-slide flex items-center gap-3 rounded-xl px-4 py-3 ${r.name === "You" ? "bg-gold/15 ring-1 ring-gold/50" : "bg-ink/40"}`}
            style={d(200 + i * 120)}
          >
            <span className="w-4 font-display text-gold">{i + 1}</span>
            <span className="flex-1 font-medium text-pearl">{r.name}</span>
            <span className="text-sm text-silver-dim tabular-nums">±{r.gap.toFixed(2)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The landing's explainer: how accuracy works, catching up, and the leaderboards. */
export function LandingSections() {
  return (
    <>
      <Section
        id="accuracy"
        eyebrow="HOW SCORING WORKS"
        title="you vs every judge."
        body="Each dance you score is measured against the panel once all the judges' scores are confirmed. Your accuracy is how many points off you are on average: against the judges' average, and against each judge on their own."
        points={[
          "Find the judge you read best, and the one you never agree with.",
          "Break it down by dance style, and see how your paddles spread against theirs.",
          "Dead on is zero. Your number drops as your eye sharpens over the season.",
        ]}
        art={<AccuracyArt />}
      />
      <Section
        id="catch-up"
        eyebrow="CATCH UP"
        title="missed a week? it waits."
        body="Nothing is spoiled until you get to it. Watch on replay days later and every dance is still waiting for your paddle, week by week, so a later episode never gives away who went home."
        points={[
          "Score each missed week in order, or skip ahead and let the earlier dances go.",
          "Already watched it? Reveal a dance without scoring it.",
          "Past seasons are joining the catalog, so you can judge the classics too.",
        ]}
        art={<CatchUpArt />}
        flip
      />
      <Section
        id="leaderboards"
        eyebrow="LEADERBOARDS AND FRIENDS"
        title="settle it on the board."
        body="The season leaderboard ranks everyone by accuracy once they have scored 5 dances. Add friends, start a group for the people you watch with, and narrow any reveal or board down to just them."
        points={[
          "Friends see your paddle for a dance only after they've scored it themselves.",
          "Share a group's invite link and the whole couch is in.",
          "Your groups and friends follow your Armchair Judge account to every show.",
        ]}
        art={<BoardArt />}
      />
    </>
  );
}
