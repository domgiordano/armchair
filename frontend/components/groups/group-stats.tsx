"use client";

import { useState } from "react";

import { formatScore } from "@/components/performance-card";
import { DivergingBars, LineChart, SeriesLegend, signed, type Series } from "@/components/stats/charts";
import { CrowdView } from "@/components/stats/crowd-view";
import { celebrity, gap, lean, pct, weekTick } from "@/components/stats/parts";
import { StatsSkeleton } from "@/components/stats/stats-screen";
import { useFetch } from "@/components/stats/use-fetch";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ErrorState } from "@/components/ui/states";
import type { Group, GroupDetail } from "@armchair/app-core/api/groups";
import type { Season } from "@/lib/api/show";
import { getCrowdStats, getPersonStats, type CrowdStats, type PersonStats } from "@/lib/api/stats";
import { useSeason } from "@/lib/show/use-season";

/** The group's whole stats view: the Groups tab of /stats/, on the group's own page. */
export function GroupStats({ group }: { group: GroupDetail }) {
  const load = useSeason();
  if (load.kind === "loading") return <StatsSkeleton label="Loading the season" />;
  if (load.kind === "error") return <ErrorState what="the season" message={load.message} retry={load.retry} />;
  return <GroupStatsFetcher season={load.season} group={group} />;
}

function GroupStatsFetcher({ season, group }: { season: Season; group: GroupDetail }) {
  const [load, retry] = useFetch<[CrowdStats, PersonStats | null]>(
    () => Promise.all([getCrowdStats(season.season, "group", group.id), getPersonStats(season.season).catch(() => null)]),
    `${season.season}|${group.id}`,
  );
  if (load.kind === "loading") return <StatsSkeleton label="Loading the group's stats" />;
  if (load.kind === "error") return <ErrorState what="the group's stats" message={load.message} retry={retry} />;
  return <CrowdView season={season} crowd={load.value[0]} me={load.value[1]} name={group.name} />;
}

const EVERYONE = "everyone";

/** This group beside another of yours, or beside everyone. */
export function GroupCompare({ group, groups }: { group: GroupDetail; groups: Group[] }) {
  const load = useSeason();
  const others = groups.filter((g) => g.id !== group.id);
  const [other, setOther] = useState(EVERYONE);
  if (load.kind === "loading") return <StatsSkeleton label="Loading the season" />;
  if (load.kind === "error") return <ErrorState what="the season" message={load.message} retry={load.retry} />;
  const picked = others.find((g) => g.id === other) ?? null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-silver-dim">
        <span>
          <span className="text-pearl">{group.name}</span> against
        </span>
        <Select
          label="Compare with"
          hideLabel
          className="w-56"
          value={picked ? picked.id : EVERYONE}
          options={[{ value: EVERYONE, label: "Everyone" }, ...others.map((g) => ({ value: g.id, label: g.name }))]}
          onChange={setOther}
        />
      </div>
      <CompareFetcher season={load.season} a={group} b={picked} />
    </div>
  );
}

function CompareFetcher({ season, a, b }: { season: Season; a: Group; b: Group | null }) {
  const [load, retry] = useFetch<[CrowdStats, CrowdStats]>(
    () =>
      Promise.all([
        getCrowdStats(season.season, "group", a.id),
        b ? getCrowdStats(season.season, "group", b.id) : getCrowdStats(season.season, "global"),
      ]),
    `${season.season}|${a.id}|${b?.id ?? EVERYONE}`,
  );
  if (load.kind === "loading") return <StatsSkeleton label="Loading both" />;
  if (load.kind === "error") return <ErrorState what="the comparison" message={load.message} retry={retry} />;
  return <Comparison season={season} left={load.value[0]} right={load.value[1]} names={[a.name, b?.name ?? "Everyone"]} />;
}

type Row = { label: string; value: (c: CrowdStats) => string; better?: (c: CrowdStats) => number | null };

const ROWS: Row[] = [
  { label: "Average gap", value: (c) => (c.mae === null ? "-" : gap(c.mae)), better: (c) => (c.mae === null ? null : -c.mae) },
  { label: "Dead on", value: (c) => pct(c.exact), better: (c) => c.exact },
  { label: "Within a point", value: (c) => pct(c.close), better: (c) => c.close },
  { label: "Lean", value: (c) => lean(c.bias), better: (c) => (c.bias === null ? null : -Math.abs(c.bias)) },
  { label: "People scoring", value: (c) => String(c.raters) },
  { label: "Paddles counted", value: (c) => String(c.count) },
  {
    label: "Best week",
    value: (c) => {
      const best = [...c.weeks].filter((w) => w.mae !== null).sort((x, y) => (x.mae ?? 0) - (y.mae ?? 0))[0];
      return best ? `W${best.week ?? best.ep} · ${gap(best.mae ?? 0)}` : "-";
    },
  },
];

function Comparison({ season, left, right, names }: { season: Season; left: CrowdStats; right: CrowdStats; names: [string, string] }) {
  const eps = [...new Set([...left.weeks, ...right.weeks].map((w) => w.ep))].sort((x, y) => x - y);
  const series: Series[] = [left, right].map((c, i) => ({
    id: names[i],
    label: names[i],
    values: eps.map((ep) => c.weeks.find((w) => w.ep === ep)?.mae ?? null),
    ...(i === 1 ? { color: "#8ea2ff" } : {}),
  }));
  const top = Math.max(1, Math.ceil(Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)))));
  const styles = [...new Set([...left.styles, ...right.styles].map((s) => s.style))]
    .map((style) => {
      const l = left.styles.find((s) => s.style === style)?.delta ?? null;
      const r = right.styles.find((s) => s.style === style)?.delta ?? null;
      return { style, l, r };
    })
    .filter((s) => s.l !== null && s.r !== null)
    .sort((x, y) => Math.abs((y.l ?? 0) - (y.r ?? 0)) - Math.abs((x.l ?? 0) - (x.r ?? 0)));
  const couples = left.couples
    .map((c) => ({ id: c.id, l: c.delta, r: right.couples.find((x) => x.id === c.id)?.delta ?? null }))
    .filter((c): c is { id: string; l: number; r: number } => c.l !== null && c.r !== null)
    .sort((x, y) => Math.abs(y.l - y.r) - Math.abs(x.l - x.r))
    .slice(0, 6);

  return (
    <div className="stagger gap-4 lg:columns-2 [&>section]:mb-4 [&>section]:break-inside-avoid">
      <Card id="side-by-side" title="Side by side" note="Over the dances you've seen. The better of each is gold.">
        <table className="w-full table-fixed text-sm">
          <thead className="text-left text-xs text-silver-dim">
            <tr>
              <th scope="col" className="w-[38%] pb-2 font-normal">
                <span className="sr-only">Number</span>
              </th>
              {names.map((n) => (
                <th key={n} scope="col" className="truncate pb-2 text-right font-normal text-pearl">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-silver/10 tabular-nums">
            {ROWS.map((row) => {
              const scores = [left, right].map((c) => row.better?.(c) ?? null);
              // Equal as shown is a tie, even when the unrounded numbers differ.
              const tied = row.value(left) === row.value(right);
              const win = !tied && scores[0] !== null && scores[1] !== null ? (scores[0] > scores[1] ? 0 : 1) : null;
              return (
                <tr key={row.label}>
                  <th scope="row" className="py-2 text-left font-normal text-silver-dim">
                    {row.label}
                  </th>
                  {[left, right].map((c, i) => (
                    <td key={i} className={i === win ? "py-2 text-right font-semibold text-gold-light" : "py-2 text-right text-pearl"}>
                      {row.value(c)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {eps.length > 1 && (
        <Card id="compare-weeks" title="Gap by week" note="Average points off the judges each week. Lower is closer.">
          <LineChart label={`${names[0]} and ${names[1]} by week`} ticks={eps.map((ep) => weekTick(season, ep))} series={series} domain={[0, top]} />
          <SeriesLegend series={series} />
        </Card>
      )}

      {styles.length > 0 && (
        <Card id="compare-styles" title="Where you split on style" note={`${names[0]}'s lean minus ${names[1]}'s: gold is where ${names[0]} scores higher.`}>
          <DivergingBars
            label="Style leanings compared"
            rows={styles.slice(0, 8).map((s) => ({
              key: s.style,
              label: s.style,
              value: Math.round(((s.l ?? 0) - (s.r ?? 0)) * 100) / 100,
              note: `${signed(s.l ?? 0)} vs ${signed(s.r ?? 0)}`,
            }))}
          />
        </Card>
      )}

      {couples.length > 0 && (
        <Card id="compare-couples" title="Couples you see differently" note="Each side's average against the judges.">
          <ul aria-label="Couples you see differently" className="flex flex-col divide-y divide-silver/10 text-sm">
            {couples.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-pearl">{celebrity(season, c.id)}</span>
                <span className="shrink-0 text-right text-xs text-silver-dim tabular-nums">
                  <span className="text-pearl">{signed(c.l)}</span> {names[0]} · <span className="text-pearl">{signed(c.r)}</span> {names[1]}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card id="compare-favorites" title="Favorites" note="The couple each scores furthest above the judges.">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[left, right].map((c, i) => (
            <div key={i} className="flex min-w-0 flex-col gap-1">
              <dt className="truncate text-xs text-silver-dim">{names[i]}</dt>
              <dd className="flex flex-col">
                {c.favorites.length === 0 ? (
                  <span className="text-silver-dim">None yet</span>
                ) : (
                  c.favorites.map((id) => (
                    <span key={id} className="truncate text-pearl">
                      {celebrity(season, id)}{" "}
                      <span className="text-xs text-silver-dim tabular-nums">
                        {formatScore(c.couples.find((x) => x.id === id)?.crowd ?? 0)}
                      </span>
                    </span>
                  ))
                )}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
