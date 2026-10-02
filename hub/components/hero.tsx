import { Fragment, type CSSProperties } from "react";

import { DeskDemo } from "@/components/desk-demo";
import { SlateDemo } from "@/components/slate-demo";
import { dwtsLink, traitorsLink } from "@/lib/links";

const LINE = ["You’ve", "always", "judged", "from", "the", "couch."];

// Each piece of the hero enters in turn once the intro hands off (app/globals.css, .hero-in).
const step = (i: number) => ({ "--i": i }) as CSSProperties;

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative scroll-mt-20 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_15%_10%,rgb(59_91_255/0.16),transparent),radial-gradient(50%_45%_at_90%_40%,rgb(232_63_208/0.14),transparent)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pt-14 pb-16 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-24 lg:pb-24">
        <div>
          <p className="hero-in text-xs font-semibold tracking-[0.3em] text-gold uppercase" style={step(0)}>
            Play along with the shows you watch
          </p>
          <h1 id="hero-title" className="mt-4 text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            {LINE.map((word, i) => (
              <Fragment key={word}>
                <span className="hero-in inline-block" style={step(i + 1)}>
                  {word}
                </span>{" "}
              </Fragment>
            ))}
            <span className="hero-in mt-1 block text-brand-gradient" style={step(LINE.length + 2)}>
              Now it counts.
            </span>
          </h1>
          <p className="hero-in mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg" style={step(10)}>
            Watch live or catch up later, and make your call before the show does: score every dance against the judges,
            or name who the round table banishes and who gets murdered in the night. Nobody else&rsquo;s call shows
            until yours is in. Then the reveal, the points and a season-long race with your friends.
          </p>
          <div className="hero-in mt-8 flex flex-wrap items-center gap-3" style={step(12)}>
            <a
              href={dwtsLink()}
              className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-text px-6 font-semibold text-night shadow-lg shadow-violet/20 hover:bg-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold transition active:scale-[0.98] motion-reduce:transition-none"
            >
              Judge Dancing with the Stars
              <svg viewBox="0 0 16 16" className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a
              href={traitorsLink()}
              className="group inline-flex min-h-12 items-center gap-2 rounded-full border border-[#e9dcc0]/40 bg-[#0b2418] px-6 font-semibold text-[#e9dcc0] hover:border-[#e9dcc0] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold transition active:scale-[0.98] motion-reduce:transition-none"
            >
              Play The Traitors
              <svg viewBox="0 0 16 16" className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a
              href="#how"
              className="inline-flex min-h-12 items-center rounded-full border border-line px-6 font-semibold text-text hover:border-muted hover:bg-night-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold transition active:scale-[0.98] motion-reduce:transition-none"
            >
              How it works
            </a>
          </div>
          <p className="hero-in mt-5 text-xs text-muted/80" style={step(13)}>
            The desk and the slate on this page are illustrations with invented names and scores.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="hero-in hero-desk" style={step(5)}>
            <DeskDemo />
          </div>
          <div className="hero-in" style={step(7)}>
            <SlateDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
