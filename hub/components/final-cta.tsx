import { DWTS_URL } from "@/lib/links";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="px-6 pb-20 sm:pb-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-line bg-night-2 px-6 py-14 sm:px-12 sm:py-16">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_0%_100%,rgb(59_91_255/0.22),transparent),radial-gradient(45%_70%_at_100%_0%,rgb(232_63_208/0.2),transparent)]"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 id="cta-title" className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              Next show night, <span className="text-brand-gradient">bring a paddle.</span>
            </h2>
            <p className="mt-3 text-muted">Sign in with Google, start a group, and see who in it has the judges&rsquo; eye.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={DWTS_URL}
              className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-text px-6 font-semibold text-night shadow-lg shadow-violet/20 hover:bg-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold transition active:scale-[0.98] motion-reduce:transition-none"
            >
              Start judging
              <svg viewBox="0 0 16 16" className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a
              href="#faq"
              className="inline-flex min-h-12 items-center rounded-full border border-line px-6 font-semibold hover:border-muted hover:bg-night focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold transition active:scale-[0.98] motion-reduce:transition-none"
            >
              Read the FAQ
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
