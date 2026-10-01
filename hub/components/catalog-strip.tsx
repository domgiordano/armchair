import { CountUp } from "@/components/count-up";
import { catalogCounts } from "@/lib/catalog";
import { reveal } from "@/lib/reveal";

export function CatalogStrip() {
  const c = catalogCounts();
  const stats = [
    { value: c.seasons, label: "Seasons covered", note: `${c.firstYear} to ${c.lastYear}` },
    { value: c.performances, label: "Performances", note: "Every dance, by couple and style" },
    { value: c.judgeScores, label: "Judges' scores loaded", note: "Each paddle, judge by judge" },
    { value: c.couples, label: "Couples", note: "Celebrities and their pros" },
  ];

  return (
    <section aria-labelledby="numbers-title" className="relative overflow-hidden border-y border-line bg-night-2/50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-0 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(122_44_255/0.18),transparent)]"
      />
      <div className="relative mx-auto max-w-6xl px-6 py-12 sm:py-14">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between" {...reveal()}>
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">By the numbers</p>
            <h2 id="numbers-title" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Every season of <span className="text-brand-gradient">Dancing with the Stars.</span>
            </h2>
          </div>
          <p className="max-w-xs text-xs leading-relaxed text-muted sm:text-right">
            Counted from the app&rsquo;s season catalog when this page was built. Live-season scores land as they air.
          </p>
        </div>
        <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className="flex flex-col border-l-2 border-violet/60 pl-4" {...reveal(i + 1)}>
              <dt className="text-sm font-semibold tracking-tight text-text">{s.label}</dt>
              <dd className="order-first text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">
                <CountUp value={s.value} />
              </dd>
              <dd className="mt-1 text-xs leading-snug text-muted">{s.note}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
