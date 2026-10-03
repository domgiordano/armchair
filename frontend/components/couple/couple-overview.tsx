import type { CSSProperties, ReactNode } from "react";

import { PersonLink } from "@/components/couple-names";
import { formatScore } from "@/components/performance-card";
import { CountUp } from "@/components/ui/count-up";
import { Skeleton } from "@/components/ui/skeleton";
import type { PersonPage, SeasonResult } from "@/lib/api/people";
import { career, overviewLines, partnership, placeText, type CoupleTotals, type Segment } from "@/lib/show/couple";
import { ordinal } from "@/lib/show/couples";
import { seasonLabel } from "@/lib/show/seasons";
import { EYEBROW } from "@/lib/ui";

interface CoupleOverviewProps {
  celeb: PersonPage;
  /** The pro's brief page: undefined while it loads, null if it couldn't. */
  pro: { id: string; name: string; page: PersonPage | null | undefined };
  season: string;
  totals: CoupleTotals;
  result: SeasonResult | null;
}

/** Who the two of them are, a few quick facts, and the partnership in numbers. */
export function CoupleOverview({ celeb, pro, season, totals, result }: CoupleOverviewProps) {
  const loading = pro.page === undefined;
  const lines = overviewLines(celeb, { ...pro, page: pro.page ?? null }, season);
  const run = pro.page ? career(pro.page, season) : null;
  const together = partnership(celeb.performances.filter((r) => r.season === season));
  const mine = celeb.seasons.find((s) => s.season === season && s.role !== "judge");

  const facts = [
    seasonLabel(season),
    celeb.category,
    run && (run.nth === 1 ? "Pro's debut" : `Pro's ${ordinal(run.nth)} season`),
    run && run.partners > 0 && `${run.partners} previous ${run.partners === 1 ? "partner" : "partners"}`,
    run && run.titles.length > 0 && `Pro has ${run.titles.length} ${run.titles.length === 1 ? "title" : "titles"}`,
    totals.best && `Best dance: ${totals.best.style ?? "Dance"} ${formatScore(totals.best.panelMean ?? 0)}`,
    mine?.place && mine.cast ? placeText(mine.place, mine.cast) : finish(result),
  ].filter((f): f is string => Boolean(f));

  return (
    <section
      aria-labelledby="overview"
      className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start"
    >
      <div className="flex flex-col gap-4">
        <h2 id="overview" className={EYEBROW}>
          Overview
        </h2>
        <div aria-live="polite" className="flex max-w-prose flex-col gap-2 text-base leading-relaxed text-silver">
          {lines.length > 0 ? (
            <p className="text-pretty">
              {lines.map((line, i) => (
                <span key={i}>
                  {i > 0 && " "}
                  {line.map((s, j) => (
                    <Piece key={j} segment={s} />
                  ))}
                </span>
              ))}
            </p>
          ) : (
            !loading && <p className="text-silver-dim">No bio on file for this couple yet.</p>
          )}
          {loading && <Skeleton className="h-4 w-4/5 rounded" />}
        </div>
        <ul aria-label="Quick facts" className="stagger flex flex-wrap gap-2">
          {facts.map((f) => (
            <li
              key={f}
              className="rounded-full border border-silver/15 bg-ink/40 px-3 py-1 text-xs font-medium text-pearl"
            >
              {f}
            </li>
          ))}
        </ul>
      </div>

      <section aria-labelledby="partnership" className="flex flex-col gap-3">
        <h2 id="partnership" className={EYEBROW}>
          Partnership
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 lg:grid-cols-2">
          <Stat i={0} label="Nights together" value={<CountUp value={together.nights} />} />
          <Stat
            i={1}
            label={together.styles.length === 1 ? "Style" : "Styles"}
            value={<CountUp value={together.styles.length} />}
            note={together.styles.slice(-3).join(", ")}
          />
          <Stat
            i={2}
            label="Top from the judges"
            value={together.top === null ? "–" : <CountUp value={together.top} format={(n) => n.toFixed(1)} />}
            note={together.top === null ? "Score a dance to see it" : undefined}
          />
          <Stat i={3} label="Perfect 10s" value={<CountUp value={together.tens} />} />
        </dl>
      </section>
    </section>
  );
}

function finish(result: SeasonResult | null): string | null {
  if (!result || "locked" in result) return null;
  if (result.status === "out") return result.week === null ? "Out" : `Out in week ${result.week}`;
  return result.status === "finalist" ? "Made the finale" : null;
}

function Piece({ segment }: { segment: Segment }) {
  if (typeof segment === "string") return segment;
  return <PersonLink id={segment.id} name={segment.name} className="font-medium text-pearl" />;
}

function Stat({ i, label, value, note }: { i: number; label: string; value: ReactNode; note?: string }) {
  return (
    <div
      style={{ "--d": `${i * 70}ms` } as CSSProperties}
      className="flex min-w-0 animate-[rise-in_560ms_cubic-bezier(0.2,0.8,0.3,1)_backwards] flex-col-reverse gap-0.5 border-l-2 border-gold/30 py-1 pl-3 [animation-delay:var(--d)]"
    >
      <dt className="text-xs text-silver-dim">
        {label}
        {note && <span className="block truncate text-[11px] text-silver-dim/80">{note}</span>}
      </dt>
      <dd className="font-display text-3xl text-pearl tabular-nums">{value}</dd>
    </div>
  );
}
