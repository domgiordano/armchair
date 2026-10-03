import type { ReactNode } from "react";

import { ChalkTallyDemo } from "@/components/chalk-tally-demo";
import { PaddleFlipDemo } from "@/components/paddle-flip-demo";
import { ShowIcon, type Show } from "@/components/show-icon";
import { dwtsLink, traitorsLink } from "@/lib/links";
import { reveal } from "@/lib/reveal";

interface Play {
  show: Show;
  name: string;
  tagline: string;
  steps: { title: string; body: string }[];
  scoring: string;
  href: string;
  cta: string;
  accent: string;
  demo: ReactNode;
}

const PLAYS: Play[] = [
  {
    show: "dwts",
    name: "Dancing with the Stars",
    tagline: "Your paddle against the panel's.",
    steps: [
      { title: "Pick the couple on the floor", body: "Cards stay alphabetical, so the running order never gives away who is still dancing." },
      { title: "Paddle up, 1 to 10", body: "Score while they dance. Once it's in, it's final, and nobody's paddle shows until yours does." },
      { title: "The desk flips", body: "Each judge's paddle turns over beside yours, with your group's and the whole room's average." },
      { title: "Catch up any night", body: "Missed a week? Every dance waits, unspoiled, until you score it or choose to reveal it." },
    ],
    scoring: "Accuracy is your average distance from the judges, overall and judge by judge. Lower is better, and it ranks you on the season leaderboard.",
    href: dwtsLink(),
    cta: "Judge Dancing with the Stars",
    accent: "text-[#f3d98b]",
    demo: <PaddleFlipDemo />,
  },
  {
    show: "traitors",
    name: "The Traitors",
    tagline: "Your slate against the round table's.",
    steps: [
      { title: "Rank the round table", body: "Your top three for the most votes. Your first pick is who you think gets banished." },
      { title: "Call the night", body: "Name the murder victim, and the recruit if you smell one. Picks lock when the episode is released." },
      { title: "Back your winners", body: "One or two, Faithful or Traitor. Lock in before the premiere for full points." },
      { title: "The tally", body: "As each episode lands, your sealed slate opens beside everyone else's and the points go up." },
    ],
    scoring: "Exact slots score 5, 3 and 2, a right name in the wrong slot 1, the murder and the recruit 4 each. US and UK seasons.",
    href: traitorsLink(),
    cta: "Play The Traitors",
    accent: "text-[#e9dcc0]",
    demo: <ChalkTallyDemo />,
  },
];

export function ShowPlaybook() {
  return (
    <section id="play" aria-labelledby="play-title" className="scroll-mt-20 border-t border-line py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center" {...reveal()}>
          <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">How each show plays</p>
          <h2 id="play-title" className="mx-auto mt-3 max-w-2xl text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            Same rule everywhere: <span className="text-brand-gradient">call it before you see it.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">Each show keeps its own game and its own way of keeping score.</p>
        </div>

        <div className="mt-14 flex flex-col gap-20">
          {PLAYS.map((p, i) => (
            <article
              key={p.show}
              aria-labelledby={`play-${p.show}`}
              className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <div className={i % 2 ? "lg:order-last" : ""} {...reveal(1)}>
                <div className="flex items-center gap-3">
                  <ShowIcon show={p.show} size={48} />
                  <div>
                    <h3 id={`play-${p.show}`} className="text-2xl font-bold tracking-tight">
                      {p.name}
                    </h3>
                    <p className={`text-sm font-medium ${p.accent}`}>{p.tagline}</p>
                  </div>
                </div>
                <ol className="mt-8 flex flex-col gap-5">
                  {p.steps.map((s, n) => (
                    <li key={s.title} className="flex gap-4">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-xs font-bold text-muted tabular-nums">
                        {n + 1}
                      </span>
                      <div>
                        <p className="font-semibold">{s.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-6 rounded-2xl border border-line bg-night-2/60 p-4 text-sm leading-relaxed text-muted">
                  <span className="font-semibold text-text">Scoring. </span>
                  {p.scoring}
                </p>
                <a
                  href={p.href}
                  className="group mt-6 inline-flex min-h-12 items-center gap-2 rounded-full border border-line px-6 font-semibold transition hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold active:scale-[0.98] motion-reduce:transition-none"
                >
                  {p.cta}
                  <svg viewBox="0 0 16 16" className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">
                    <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
              <div {...reveal(2)}>{p.demo}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
