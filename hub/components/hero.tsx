import { DeskDemo } from "@/components/desk-demo";
import { DWTS_URL } from "@/lib/links";

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative scroll-mt-20 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_15%_10%,rgb(59_91_255/0.16),transparent),radial-gradient(50%_45%_at_90%_40%,rgb(232_63_208/0.14),transparent)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-24 lg:pb-28">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">Rate the show like a judge</p>
          <h1 id="hero-title" className="mt-4 text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            You&rsquo;ve always judged from the couch.
            <span className="mt-1 block text-brand-gradient">Now it counts.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Watch live or catch up later. Hold up your paddle for every performance, 1 to 10. Nobody else&rsquo;s score
            shows until yours is in; then the real judges and everyone else flip theirs, and Armchair Judge tracks how
            close you run to the panel all season.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={DWTS_URL}
              className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-text px-6 font-semibold text-night shadow-lg shadow-violet/20 hover:bg-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold transition active:scale-[0.98] motion-reduce:transition-none"
            >
              Judge Dancing with the Stars
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
          <p className="mt-5 text-xs text-muted/80">The desk on this page is an illustration with invented scores.</p>
        </div>
        <DeskDemo />
      </div>
    </section>
  );
}
