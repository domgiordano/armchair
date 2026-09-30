interface Beat {
  time: string;
  title: string;
  body: string;
}

const BEATS: Beat[] = [
  {
    time: "8:00 PM ET",
    title: "The night opens",
    body: "Tonight's couples appear in alphabetical order, so the running order gives nothing away. Voting on the show opens with the broadcast.",
  },
  {
    time: "Each dance",
    title: "Paddle up",
    body: "Tap the couple on the floor and score them 1 to 10 while they dance. Submit and it's final. Don't want to score one? Reveal it without scoring.",
  },
  {
    time: "Minutes later",
    title: "The reveal",
    body: "The panel's scores land a few minutes after each dance. Yours is already in, so the desk turns over: judges, your group, everyone.",
  },
  {
    time: "10:00 PM ET",
    title: "Results",
    body: "Voting closes with the broadcast. Your accuracy for the night updates against the full panel, ready to compare with your group.",
  },
  {
    time: "Any night after",
    title: "Catch up",
    body: "Watching on replay? Every dance waits for you, unspoiled. Already seen the week? Reveal all and move on.",
  },
];

export function ShowNight() {
  return (
    <section id="night" aria-labelledby="night-title" className="scroll-mt-20 border-t border-line py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">Show night</p>
        <h2 id="night-title" className="mt-3 max-w-2xl text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
          How a show night <span className="text-brand-gradient">plays out.</span>
        </h2>
        <p className="mt-3 max-w-xl text-muted">Dancing with the Stars airs live on the East Coast, 8 to 10 PM Eastern.</p>

        <div className="relative mt-12">
          <span
            className="absolute top-2 bottom-2 left-[7px] w-0.5 bg-linear-to-b from-blue via-magenta to-orange opacity-60 lg:top-[7px] lg:right-0 lg:bottom-auto lg:left-0 lg:h-0.5 lg:w-auto lg:bg-linear-to-r"
            aria-hidden="true"
          />
          <ol className="grid gap-8 lg:grid-cols-5 lg:gap-6">
          {BEATS.map((b) => (
            <li key={b.title} className="relative pl-9 lg:pt-10 lg:pl-0">
              <span
                className="absolute top-0.5 left-0 size-4 rounded-full border-2 border-night bg-text ring-2 ring-violet lg:top-0"
                aria-hidden="true"
              />
              <p className="text-xs font-semibold tracking-[0.15em] text-gold uppercase tabular-nums">{b.time}</p>
              <h3 className="mt-1.5 text-lg font-semibold">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{b.body}</p>
            </li>
          ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
