"use client";

import { useState } from "react";

import { Avatar } from "@/components/avatar";
import { formatScore } from "@/components/performance-card";
import { Tile } from "@/components/profile/parts";
import { displayName } from "@/components/social/parts";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { UserLink } from "@/components/user-link";
import type { Season } from "@/lib/api/show";
import type { GroupMember } from "@armchair/app-core/api/groups";
import type { CoupleVotes, CrowdStats, CrowdWeek, PersonStats } from "@/lib/api/stats";
import { cn } from "@/lib/ui";

import { DeltaScale, DivergingBars, Heatmap, LineChart, SeriesLegend, signed, type Series } from "./charts";
import { celebrity, gap, Couple, DanceLink, danceName, lean, pct, SubHeading, versus, weekName, weekTick } from "./parts";

interface CrowdViewProps {
  season: Season;
  crowd: CrowdStats;
  /** Your own breakdown, for your line beside the crowd's. */
  me: PersonStats | null;
  /** "Everyone", or the group's name. */
  name: string;
}

/** Everyone in a scope against the judges: leaders, standings, couple votes, styles, splits. */
export function CrowdView({ season, crowd, me, name }: CrowdViewProps) {
  if (crowd.count === 0) {
    return (
      <EmptyState title="Nothing to compare yet">
        These numbers cover dances you&apos;ve scored, once every judge&apos;s score is confirmed.
      </EmptyState>
    );
  }
  const person: PersonOf = (sub) => crowd.people[sub] ?? { sub, name: null, picture: null, avatarKind: null };
  const whole = crowd.ep === null && crowd.weeks.length > 1;
  const ticks = crowd.weeks.map((w) => weekTick(season, w.ep));
  const group = crowd.members !== undefined;

  return (
    <div className="flex flex-col gap-4">
      <dl aria-label={`${name} numbers`} className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          accent
          label="Average gap"
          value={crowd.mae === null ? "-" : gap(crowd.mae)}
          note={crowd.global ? `everyone ${crowd.global.mae === null ? "-" : gap(crowd.global.mae)}` : "points off the judges"}
        />
        <Tile label="Dead on" value={pct(crowd.exact)} note={crowd.global ? `everyone ${pct(crowd.global.exact)}` : "on the judges' average"} />
        <Tile label="Lean" value={<span className="text-xl sm:text-2xl">{lean(crowd.bias)}</span>} note={crowd.global ? `everyone ${lean(crowd.global.bias).toLowerCase()}` : "against the judges"} />
        <Tile label="Scoring" value={crowd.raters} note={`${crowd.count} paddles counted`} />
      </dl>

      <div className="stagger gap-4 lg:columns-2 [&>section]:mb-4 [&>section]:break-inside-avoid">
        <Card id="leaders" title="Leaders by week" note="Each week's closest three, and who led the season after it.">
          <LeadersByWeek season={season} weeks={crowd.weeks} person={person} />
        </Card>

        {whole && <Standings crowd={crowd} ticks={ticks} person={person} me={me?.sub ?? null} />}

        {whole && crowd.global && (
          <GroupVsEveryone crowd={crowd} ticks={ticks} name={name} />
        )}

        {crowd.couples.length > 0 && (
          <Card id="votes" title="Couple votes by week" note={`How ${name.toLowerCase() === "everyone" ? "everyone" : name} scored each couple against the judges. Gold is above them, blue below.`}>
            <Heatmap
              caption="Crowd average minus the judges' average, per couple and week"
              cols={crowd.weeks.map((w) => weekTick(season, w.ep))}
              rows={[...crowd.couples]
                .sort((a, b) => (b.delta ?? -99) - (a.delta ?? -99))
                .map((c) => ({
                  id: c.id,
                  label: celebrity(season, c.id),
                  cells: crowd.weeks.map((w) => {
                    const cell = c.weeks.find((x) => x.ep === w.ep);
                    if (!cell) return null;
                    return {
                      value: cell.delta,
                      title:
                        cell.crowd === null
                          ? `${celebrity(season, c.id)}, ${weekName(season, w.ep)}: judges ${cell.judges === null ? "-" : formatScore(cell.judges)}, too few raters`
                          : `${celebrity(season, c.id)}, ${weekName(season, w.ep)}: crowd ${formatScore(cell.crowd)}, judges ${cell.judges === null ? "-" : formatScore(cell.judges)} (${signed(cell.delta ?? 0)}), ${cell.raters} raters`,
                    };
                  }),
                }))}
            />
            <DeltaScale />
          </Card>
        )}

        {crowd.couples.length > 0 && <CoupleLines season={season} crowd={crowd} me={me} name={name} />}

        <Card id="crowd-favorites" title="Favorites and least favorites" note="Couples scored furthest above and below the judges.">
          <CoupleList season={season} crowd={crowd} ids={crowd.favorites} title="Favorites" empty="No couple above the judges yet." />
          <CoupleList season={season} crowd={crowd} ids={crowd.leastFavorites} title="Least favorites" empty="No couple below the judges yet." />
        </Card>

        {crowd.styles.some((s) => s.delta !== null) && (
          <Card id="crowd-styles" title="Dance styles" note="Crowd average against the judges', by style.">
            <DivergingBars
              label="Crowd minus judges by dance style"
              rows={crowd.styles
                .filter((s) => s.delta !== null)
                .map((s) => ({ key: s.style, label: s.style, value: s.delta ?? 0, note: versus("crowd", s.crowd, "judges", s.judges) }))}
            />
          </Card>
        )}

        {crowd.divisive.length > 0 && (
          <Card id="divisive" title="Most divisive dances" note="Widest spread of paddles.">
            <ul aria-label="Most divisive dances" className="flex flex-col divide-y divide-silver/10 text-sm">
              {crowd.divisive.map(({ ep, key }) => {
                const d = crowd.dances.find((x) => x.ep === ep && x.key === key);
                if (!d) return null;
                return (
                  <li key={`${ep}-${key}`} className="flex items-center justify-between gap-3 py-2">
                    {d.couples.length === 1 ? (
                      <Couple season={season} id={d.couples[0]} out={crowd.eliminated[d.couples[0]]}>
                        <DanceLink ep={ep}>{weekName(season, ep)}</DanceLink>
                        {d.style && ` · ${d.style}`}
                      </Couple>
                    ) : (
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-pearl">{danceName(season, d.couples)}</span>
                        <span className="truncate text-xs text-silver-dim">
                          <DanceLink ep={ep}>{weekName(season, ep)}</DanceLink>
                          {d.style && ` · ${d.style}`}
                        </span>
                      </span>
                    )}
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="block text-pearl">spread {gap(d.spread ?? 0)}</span>
                      <span className="block text-xs text-silver-dim">{versus("crowd", d.crowd, "judges", d.judges)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {group && crowd.members && crowd.members.length > 0 && (
          <Card id="members" title="Members" note="Each member over the dances you've seen.">
            <ul aria-label="Members" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {crowd.members.map((m) => {
                const p = person(m.sub);
                return (
                  <li key={m.sub} className="flex flex-col gap-2 rounded-lg border border-silver/10 bg-ink/30 p-3">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={displayName(p)} email="" picture={p.picture} size={32} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <UserLink sub={m.sub} className="truncate text-pearl">
                          {displayName(p)}
                        </UserLink>
                        <span className="text-xs text-silver-dim">{m.rank === null ? `${m.count} dances, unranked` : `#${m.rank} · ${m.count} dances`}</span>
                      </span>
                      <span className="shrink-0 text-lg font-semibold text-pearl tabular-nums">{m.mae === null ? "-" : gap(m.mae)}</span>
                    </span>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <Fact label="Dead on" value={pct(m.exact)} />
                      <Fact label="Lean" value={lean(m.bias)} />
                      <Fact label="Best style" value={m.bestStyle ?? "-"} />
                      <Fact label="Generous on" value={m.favoriteStyle ?? "-"} />
                      <Fact label="Favorite" value={m.favorite ? celebrity(season, m.favorite) : "-"} />
                      <Fact label="Least favorite" value={m.leastFavorite ? celebrity(season, m.leastFavorite) : "-"} />
                    </dl>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {group && crowd.headToHead && crowd.members && crowd.members.length > 1 && (
          <Card id="h2h" title="Head to head" note="Dances both scored: who called it closer. Read across.">
            <HeadToHead crowd={crowd} person={person} />
          </Card>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-silver-dim">{label}</dt>
      <dd className="truncate text-pearl">{value}</dd>
    </div>
  );
}

type PersonOf = (sub: string) => GroupMember;

function LeadersByWeek({ season, weeks, person }: { season: Season; weeks: CrowdWeek[]; person: PersonOf }) {
  const leader = (w: CrowdWeek) => w.standings.find((s) => s.rank === 1);
  const name = (sub: string) => displayName(person(sub));
  return (
    <>
      <table className="hidden w-full table-fixed text-sm md:table">
        <thead className="text-left text-xs text-silver-dim">
          <tr>
            <th scope="col" className="w-[22%] pb-2 font-normal">Week</th>
            <th scope="col" className="pb-2 font-normal">1st</th>
            <th scope="col" className="pb-2 font-normal">2nd</th>
            <th scope="col" className="pb-2 font-normal">3rd</th>
            <th scope="col" className="pb-2 font-normal">Season leader</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-silver/10">
          {[...weeks].reverse().map((w) => {
            const top = leader(w);
            return (
              <tr key={w.ep}>
                <th scope="row" className="py-2 pr-2 text-left font-normal text-pearl">
                  {weekName(season, w.ep)}
                  <span className="block text-xs text-silver-dim">{w.participants} scored</span>
                </th>
                {[0, 1, 2].map((i) => {
                  const l = w.leaders[i];
                  return (
                    <td key={i} className="py-2 pr-2 align-top">
                      {l ? (
                        <>
                          <UserLink sub={l.sub} className="block truncate text-pearl">
                            {name(l.sub)}
                          </UserLink>
                          <span className="text-xs text-silver-dim tabular-nums">{gap(l.mae ?? 0)} off</span>
                        </>
                      ) : (
                        <span className="text-silver-dim">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="py-2 align-top">
                  {top ? (
                    <>
                      <span className="block truncate text-gold-light">{name(top.sub)}</span>
                      <span className="text-xs text-silver-dim tabular-nums">{gap(top.mae ?? 0)} off</span>
                    </>
                  ) : (
                    <span className="text-xs text-silver-dim">No one ranked yet</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ol aria-label="Leaders by week" className="flex flex-col gap-2 md:hidden">
        {[...weeks].reverse().map((w) => {
          const top = leader(w);
          return (
            <li key={w.ep} className="flex flex-col gap-1.5 rounded-lg border border-silver/10 bg-ink/30 px-3 py-2.5">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-pearl">{weekName(season, w.ep)}</span>
                <span className="shrink-0 text-xs text-silver-dim">{w.participants} scored</span>
              </span>
              <ol className="flex flex-col gap-0.5 text-sm">
                {w.leaders.map((l) => (
                  <li key={l.sub} className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="w-5 shrink-0 text-xs text-silver-dim tabular-nums">{l.rank}.</span>
                      <UserLink sub={l.sub} className="truncate text-pearl">
                        {name(l.sub)}
                      </UserLink>
                    </span>
                    <span className="shrink-0 text-xs text-silver-dim tabular-nums">{gap(l.mae ?? 0)} off</span>
                  </li>
                ))}
              </ol>
              <span className="text-xs text-silver-dim">
                Season leader after it: <span className="text-gold-light">{top ? name(top.sub) : "no one ranked yet"}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Standings({ crowd, ticks, person, me }: { crowd: CrowdStats; ticks: string[]; person: PersonOf; me: string | null }) {
  const subs = [...new Set(crowd.weeks.flatMap((w) => w.standings.filter((s) => s.rank !== null).map((s) => s.sub)))];
  // You first, so your line is the gold one.
  subs.sort((a, b) => Number(b === me) - Number(a === me));
  if (subs.length === 0) return null;
  const series: Series[] = subs.slice(0, 8).map((sub) => ({
    id: sub,
    label: sub === me ? "You" : displayName(person(sub)),
    values: crowd.weeks.map((w) => w.standings.find((s) => s.sub === sub)?.rank ?? null),
  }));
  const worst = Math.max(2, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)));
  return (
    <Card id="standings" title="Standings over time" note="Season place after each week, from five dances in.">
      <LineChart label="Season place after each week" ticks={ticks} series={series} domain={[1, worst]} invert />
      <SeriesLegend series={series} />
    </Card>
  );
}

function GroupVsEveryone({ crowd, ticks, name }: { crowd: CrowdStats; ticks: string[]; name: string }) {
  const global = crowd.global;
  if (!global) return null;
  const series: Series[] = [
    { id: "group", label: name, values: crowd.weeks.map((w) => w.mae) },
    {
      id: "everyone",
      label: "Everyone",
      values: crowd.weeks.map((w) => global.weeks.find((g) => g.ep === w.ep)?.mae ?? null),
      color: "var(--color-silver)",
      dashed: true,
    },
  ];
  const top = Math.max(1, Math.ceil(Math.max(...series.flatMap((s) => s.values.filter((v): v is number => v !== null)))));
  return (
    <Card id="vs-everyone" title={`${name} vs everyone`} note="Average gap to the judges each week. Lower is closer.">
      <LineChart label={`${name} and everyone's average gap by week`} ticks={ticks} series={series} domain={[0, top]} />
      <SeriesLegend series={series} />
    </Card>
  );
}

/** One couple week by week: the crowd's average, the judges', and yours. */
function CoupleLines({ season, crowd, me, name }: { season: Season; crowd: CrowdStats; me: PersonStats | null; name: string }) {
  const ranked = [...crowd.couples].sort((a, b) => b.dances - a.dances || a.id.localeCompare(b.id));
  const [picked, setPicked] = useState(ranked[0].id);
  const couple: CoupleVotes = crowd.couples.find((c) => c.id === picked) ?? ranked[0];
  const eps = crowd.weeks.map((w) => w.ep);
  const yours = (ep: number) => {
    const calls = (me?.calls ?? []).filter((c) => c.ep === ep && c.couples.length === 1 && c.couples[0] === couple.id);
    return calls.length ? calls.reduce((n, c) => n + c.paddle, 0) / calls.length : null;
  };
  const series: Series[] = [
    { id: "crowd", label: name, values: eps.map((ep) => couple.weeks.find((w) => w.ep === ep)?.crowd ?? null) },
    {
      id: "judges",
      label: "Judges",
      values: eps.map((ep) => couple.weeks.find((w) => w.ep === ep)?.judges ?? null),
      color: "var(--color-silver)",
      dashed: true,
    },
    ...(me ? [{ id: "you", label: "You", values: eps.map(yours), color: "#8ea2ff" }] : []),
  ];
  return (
    <Card
      id="couple-lines"
      title="One couple, week by week"
      action={
        <Select
          label="Couple"
          hideLabel
          compact
          className="w-40"
          value={couple.id}
          options={ranked.map((c) => ({ value: c.id, label: celebrity(season, c.id) }))}
          onChange={setPicked}
        />
      }
    >
      <LineChart label={`${celebrity(season, couple.id)}: ${name}, judges and you by week`} ticks={eps.map((ep) => weekTick(season, ep))} series={series} domain={[1, 10]} />
      <SeriesLegend series={series} />
    </Card>
  );
}

function CoupleList({ season, crowd, ids, title, empty }: { season: Season; crowd: CrowdStats; ids: string[]; title: string; empty: string }) {
  return (
    <div className="flex flex-col gap-1">
      <SubHeading>{title}</SubHeading>
      {ids.length === 0 ? (
        <p className="text-sm text-silver-dim">{empty}</p>
      ) : (
        <ul aria-label={title} className="flex flex-col divide-y divide-silver/10 text-sm">
          {ids.map((id) => {
            const c = crowd.couples.find((x) => x.id === id);
            return (
              <li key={id} className="flex items-center justify-between gap-3 py-2">
                <Couple season={season} id={id} out={crowd.eliminated[id]}>
                  {c && `${c.raters} raters · ${versus("crowd", c.crowd, "judges", c.judges)}`}
                </Couple>
                <span className="shrink-0 text-pearl tabular-nums">{c && c.delta !== null ? signed(c.delta) : ""}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function HeadToHead({ crowd, person }: { crowd: CrowdStats; person: PersonOf }) {
  const subs = (crowd.members ?? []).map((m) => m.sub);
  const h2h = crowd.headToHead ?? {};
  const name = (sub: string) => displayName(person(sub));
  const cell = (a: string, b: string) => h2h[a]?.[b] ?? null;
  return (
    <>
      <table className="hidden w-full table-fixed text-xs md:table">
        <caption className="sr-only">Wins, losses and ties of each row against each column</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[24%]">
              <span className="sr-only">Member</span>
            </th>
            {subs.map((s) => (
              <th key={s} scope="col" className="truncate pb-1 font-normal text-silver-dim">
                {name(s)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subs.map((a) => (
            <tr key={a}>
              <th scope="row" className="truncate py-1 pr-2 text-left font-normal text-pearl">
                {name(a)}
              </th>
              {subs.map((b) => {
                const c = a === b ? null : cell(a, b);
                return (
                  <td
                    key={b}
                    className={cn(
                      "rounded-sm py-1.5 text-center tabular-nums",
                      a === b && "bg-silver/[0.04]",
                      c && c[0] > c[1] && "bg-gold/20 text-gold-light",
                      c && c[0] < c[1] && "bg-[#8ea2ff]/15 text-silver",
                    )}
                  >
                    {c ? `${c[0]}-${c[1]}${c[2] ? `-${c[2]}` : ""}` : a === b ? "" : "-"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul aria-label="Head to head" className="flex flex-col gap-2 md:hidden">
        {subs.map((a) => (
          <li key={a} className="rounded-lg border border-silver/10 bg-ink/30 px-3 py-2.5">
            <span className="text-pearl">{name(a)}</span>
            <ul className="mt-1 flex flex-col gap-0.5 text-sm">
              {subs
                .filter((b) => b !== a)
                .map((b) => {
                  const c = cell(a, b);
                  return (
                    <li key={b} className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-silver-dim">vs {name(b)}</span>
                      <span className={cn("shrink-0 tabular-nums", c && c[0] > c[1] ? "text-gold-light" : "text-pearl")}>
                        {c ? `${c[0]}-${c[1]}${c[2] ? `, ${c[2]} tied` : ""}` : "no shared dances"}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}
