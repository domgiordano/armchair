import { CountUp } from "@/components/count-up";
import { catalogCounts } from "@/lib/catalog";
import { reveal } from "@/lib/reveal";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function CatalogStrip() {
  const c = catalogCounts();
  const stats = [
    { value: c.seasons, label: plural(c.seasons, "Season loaded", "Seasons loaded") },
    { value: c.couples, label: "Couples on the floor" },
    { value: c.episodes, label: "Episodes scheduled" },
    { value: c.judges, label: plural(c.judges, "Judge on the panel", "Judges on the panel") },
  ];

  return (
    <section aria-label="What's in the app today" className="border-y border-line bg-night-2/50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className="flex flex-col border-l-2 border-violet/60 pl-4" {...reveal(i)}>
              <dt className="text-xs font-medium tracking-wide text-muted">{s.label}</dt>
              <dd className="order-first text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">
                <CountUp value={s.value} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-xs text-muted">
          Dancing with the Stars, counted from the app&rsquo;s season catalog when this page was built.
        </p>
      </div>
    </section>
  );
}
