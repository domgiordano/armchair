"use client";

import Link from "next/link";

import { formatScore } from "@/components/performance-card";
import { Tile } from "@/components/profile/parts";
import { BarList, Histogram, Legend } from "@/components/stats-charts";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { EmptyState } from "@/components/ui/states";
import type { Season } from "@/lib/api/show";
import type { Call, PersonStats } from "@/lib/api/stats";
import { button } from "@/lib/ui";

import { DivergingBars, LineChart, SeriesLegend, signed, type Series } from "./charts";
import { Couple, gap, DanceLink, danceName, lean, pct, SubHeading, versus, weekName, weekTick } from "./parts";

const off = (mae: number) => `${gap(mae)} off`;

/** One person's breakdown: yours, or a friend's over the dances you've seen too. */
export function PersonView({ season, stats, mine }: { season: Season; stats: PersonStats; mine: boolean }) {
  const who = mine ? "You" : (stats.person.name ?? "They");
  if (stats.mae === null) {
    return (
      <EmptyState
        title="Nothing to compare yet"
        action={
          mine ? (
            <Link href="/episode/" className={button("primary", "sm")}>
              Score a dance
            </Link>
          ) : undefined
        }
      >
        {mine
          ? "Stats count dances you scored once every judge's score is confirmed."
          : "Stats about someone else cover only dances you've scored too. Score the same dances to compare."}
      </EmptyState>
    );
  }

  const whole = stats.ep === null && stats.weeks.length > 1;
  const ticks = stats.weeks.map((w) => weekTick(season, w.ep));
  const gaps: Series[] = [{ id: "gap", label: `${who}: points off per dance`, values: stats.weeks.map((w) => w.mae) }];
  const placed = stats.weeks.some((w) => w.rank !== null);
  const means: Series[] = [
    { id: "paddle", label: mine ? "Your average paddle" : `${who}'s average paddle`, values: stats.weeks.map((w) => w.paddle) },
    { id: "judges", label: "Judges' average", values: stats.weeks.map((w) => w.judges), color: "var(--color-silver)", dashed: true },
  ];
  const dances: Series[] = [
    { id: "you", label: who, values: stats.calls.map((c) => c.paddle) },
    { id: "judges", label: "Judges' average", values: stats.calls.map((c) => c.judges), color: "var(--color-silver)" },
  ];
  const total = stats.distribution.reduce((n, d) => n + d.you, 0);
  const judgeName = (id: string) => season.judges.find((j) => j.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="overall"
        className="relative flex flex-col gap-1 overflow-hidden rounded-xl border border-gold/25 bg-gradient-to-br from-ballroom to-ink p-5"
      >
        <span
          aria-hidden="true"
          className="absolute -top-16 -right-10 size-48 rounded-full bg-[radial-gradient(circle,rgb(232_194_104/0.18),transparent_70%)]"
        />
        <h2 id="overall" className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">
          Against the judges&apos; average
        </h2>
        <p className="text-4xl font-semibold text-pearl tabular-nums">
          <CountUp value={stats.mae} format={off} />
        </p>
        <p className="text-sm text-silver-dim">
          Average gap per dance, over {stats.count} {stats.count === 1 ? "dance" : "dances"}.
          {stats.rank !== null && ` #${stats.rank} of ${stats.ranked} on the dances you've seen.`}
        </p>
      </section>

      <dl aria-label="Numbers" className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Dead on" value={pct(stats.exact)} note="paddle on the judges' average" />
        <Tile label="Within a point" value={pct(stats.close)} note={`of ${stats.count} dances`} />
        <Tile label="Lean" value={<span className="text-xl sm:text-2xl">{lean(stats.bias)}</span>} note="against the judges" />
        <Tile label="Streak" value={stats.streak.current} note={`within a point in a row · best ${stats.streak.best}`} />
      </dl>

      <div className="stagger gap-4 lg:columns-2 [&>section]:mb-4 [&>section]:break-inside-avoid">
        {whole && (
          <Card id="gap-weeks" title="Gap by week" note="Points off the judges' average per dance. Lower is closer.">
            <LineChart
              label={`Gap by week: ${stats.weeks.map((w, i) => `${ticks[i]} ${gap(w.mae ?? 0)}`).join(", ")}`}
              ticks={ticks}
              series={gaps}
              domain={[0, Math.max(1, Math.ceil(Math.max(...stats.weeks.map((w) => w.mae ?? 0))))]}
            />
          </Card>
        )}

        {whole && placed && (
          <Card id="place-weeks" title="Place by week" note="Among everyone on the dances you've seen that week.">
            <LineChart
              label={`Place by week: ${stats.weeks.map((w, i) => `${ticks[i]} ${w.rank ?? "unranked"}`).join(", ")}`}
              ticks={ticks}
              series={[{ id: "rank", label: "Place", values: stats.weeks.map((w) => w.rank) }]}
              domain={[1, Math.max(2, ...stats.weeks.map((w) => w.ranked))]}
              invert
            />
          </Card>
        )}

        {whole && (
          <Card id="means-weeks" title={`${who} vs the judges by week`} note="Average paddle against the judges' average.">
            <LineChart label={`${who} and the judges' average by week`} ticks={ticks} series={means} domain={[1, 10]} />
            <SeriesLegend series={means} />
          </Card>
        )}

        <Card id="weeks" title="Week by week">
          <WeekTable season={season} stats={stats} />
        </Card>

        <Card id="styles" title="By dance style" note="Points off the judges, and which way the paddle leans.">
          <BarList
            label="Gap by dance style"
            bars={stats.styles.map((s) => ({ label: s.style, value: s.mae ?? 0, count: s.count }))}
          />
          {stats.styles.length > 0 && (
            <>
              <SubHeading>Over and under the judges</SubHeading>
              <DivergingBars
                label="Lean by dance style"
                rows={[...stats.styles]
                  .sort((a, b) => (b.bias ?? 0) - (a.bias ?? 0))
                  .map((s) => ({ key: s.style, label: s.style, value: s.bias ?? 0, note: versus("paddle", s.paddle, "judges", s.judges) }))}
              />
            </>
          )}
        </Card>

        {stats.byJudge.length > 0 && (
          <Card id="judges" title={`Closest to ${judgeName(stats.byJudge[0].id)}`} note="Points off each judge, and dances counted.">
            <BarList label="By judge" bars={stats.byJudge.map((j) => ({ label: judgeName(j.id), value: j.mae, count: j.count }))} />
          </Card>
        )}

        <Card id="favorites" title="Favorites and least favorites" note="Couples scored furthest above and below the judges.">
          <Leaning season={season} stats={stats} ids={stats.favorites} title="Favorites" empty="No couple above the judges yet." />
          <Leaning season={season} stats={stats} ids={stats.leastFavorites} title="Least favorites" empty="No couple below the judges yet." />
          {(stats.styleLikes.length > 0 || stats.styleDislikes.length > 0) && (
            <p className="text-sm text-silver-dim">
              {stats.styleLikes.length > 0 && <>Generous on {stats.styleLikes.join(", ")}. </>}
              {stats.styleDislikes.length > 0 && <>Tough on {stats.styleDislikes.join(", ")}.</>}
            </p>
          )}
        </Card>

        <Card id="calls" title="Best calls and biggest misses">
          <Calls season={season} title="Best calls" calls={stats.best} />
          {stats.worst.length > 0 && <Calls season={season} title="Biggest misses" calls={stats.worst} />}
        </Card>

        <Card id="distribution" title="How the paddle lands" note="Share of paddles and of the judges' averages at each value.">
          <Histogram
            bins={stats.distribution.map((d) => ({
              value: d.score,
              mine: total ? d.you / total : 0,
              judges: total ? d.judges / total : 0,
            }))}
          />
          <Legend
            items={[
              { label: who, swatch: "bg-gold" },
              { label: "Judges", swatch: "bg-silver-dim" },
            ]}
          />
        </Card>

        {stats.calls.length > 1 && (
          <Card id="dances" title="Dance by dance">
            <LineChart
              label={`${who} and the judges' average across ${stats.calls.length} dances`}
              ticks={stats.calls.map((c) => weekTick(season, c.ep))}
              series={dances}
              domain={[1, 10]}
            />
            <SeriesLegend series={dances} />
          </Card>
        )}
      </div>
    </div>
  );
}

function WeekTable({ season, stats }: { season: Season; stats: PersonStats }) {
  return (
    <>
      <table className="hidden w-full text-sm md:table">
        <thead className="text-left text-xs text-silver-dim">
          <tr>
            <th scope="col" className="pb-2 font-normal">Week</th>
            <th scope="col" className="pb-2 text-right font-normal">Dances</th>
            <th scope="col" className="pb-2 text-right font-normal">Gap</th>
            <th scope="col" className="pb-2 text-right font-normal">Dead on</th>
            <th scope="col" className="pb-2 text-right font-normal">Lean</th>
            <th scope="col" className="pb-2 text-right font-normal">Place</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-silver/10 tabular-nums">
          {stats.weeks.map((w) => (
            <tr key={w.ep}>
              <th scope="row" className="py-2 text-left font-normal text-pearl">
                {weekName(season, w.ep)}
                {w.theme && <span className="block text-xs text-silver-dim">{w.theme}</span>}
              </th>
              <td className="py-2 text-right">{w.count}</td>
              <td className="py-2 text-right text-pearl">{w.mae === null ? "-" : gap(w.mae)}</td>
              <td className="py-2 text-right">{pct(w.exact)}</td>
              <td className="py-2 text-right">{w.bias === null ? "-" : signed(w.bias)}</td>
              <td className="py-2 text-right">{w.rank === null ? "-" : `#${w.rank} of ${w.ranked}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul aria-label="Week by week" className="flex flex-col gap-2 md:hidden">
        {stats.weeks.map((w) => (
          <li key={w.ep} className="flex items-center justify-between gap-3 rounded-lg border border-silver/10 bg-ink/30 px-3 py-2.5">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-pearl">{weekName(season, w.ep)}</span>
              <span className="truncate text-xs text-silver-dim">
                {w.count} {w.count === 1 ? "dance" : "dances"} · {pct(w.exact)} dead on · {lean(w.bias)}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end tabular-nums">
              <span className="text-pearl">{w.mae === null ? "-" : off(w.mae)}</span>
              <span className="text-xs text-silver-dim">{w.rank === null ? "unranked" : `#${w.rank} of ${w.ranked}`}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Leaning({ season, stats, ids, title, empty }: { season: Season; stats: PersonStats; ids: string[]; title: string; empty: string }) {
  return (
    <div className="flex flex-col gap-1">
      <SubHeading>{title}</SubHeading>
      {ids.length === 0 ? (
        <p className="text-sm text-silver-dim">{empty}</p>
      ) : (
        <ul aria-label={title} className="flex flex-col divide-y divide-silver/10 text-sm">
          {ids.map((id) => {
            const c = stats.couples.find((x) => x.id === id);
            return (
              <li key={id} className="flex items-center justify-between gap-3 py-2">
                <Couple season={season} id={id} out={stats.eliminated[id]}>
                  {c && `${c.count} ${c.count === 1 ? "dance" : "dances"} · ${versus("paddle", c.paddle, "judges", c.judges)}`}
                </Couple>
                <span className="shrink-0 text-pearl tabular-nums">{c && c.bias !== null ? signed(c.bias) : ""}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Calls({ season, title, calls }: { season: Season; title: string; calls: Call[] }) {
  return (
    <div className="flex flex-col gap-1">
      <SubHeading>{title}</SubHeading>
      <ul aria-label={title} className="flex flex-col divide-y divide-silver/10 text-sm">
        {calls.map((c) => (
          <li key={`${c.ep}-${c.key}`} className="flex items-center justify-between gap-3 py-2">
            {c.couples.length === 1 ? (
              <Couple season={season} id={c.couples[0]}>
                <DanceLink ep={c.ep}>{weekName(season, c.ep)}</DanceLink>
                {c.style && ` · ${c.style}`}
              </Couple>
            ) : (
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-pearl">{danceName(season, c.couples)}</span>
                <span className="truncate text-xs text-silver-dim">
                  <DanceLink ep={c.ep}>{weekName(season, c.ep)}</DanceLink>
                  {c.style && ` · ${c.style}`}
                </span>
              </span>
            )}
            <span className="shrink-0 text-right tabular-nums">
              <span className="block">
                {c.paddle} · judges {formatScore(c.judges)}
              </span>
              <span className="block text-xs text-silver-dim">{off(c.error)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
