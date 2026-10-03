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
        <div className="flex flex-col items-center gap-2 text-center" {...reveal()}>
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-gold uppercase">By the numbers</p>
            <h2 id="numbers-title" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Dancing with the Stars, <span className="text-brand-gradient">every season.</span>
            </h2>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-muted">
            Counted from the Dancing with the Stars catalog when this page was built. Live-season scores land as they
            air.
          </p>
        </div>
        <dl className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
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
