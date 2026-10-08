"use client";

import { useEffect, useState } from "react";

import { FaceDownNotice } from "@/components/face-down";
import { WHY } from "@/components/people-picks";
import { PlayerChip } from "@/components/player-chip";
import { seasonPlayerHref } from "@/components/player-link";
import { errorText, useSeasonView } from "@/components/season-data";
import { useSeasonName } from "@/components/season-provider";
import { Avatar, Headshot } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { FRIENDS, getRecord, type EventType, type PersonRecord, type RecordCall } from "@/lib/api/traitors";
import { firstName, playerOf, roman } from "@/lib/players";
import { accuracy, headToHead, mostPicked, percent, pointsOverTime, total, type Rate } from "@/lib/record";
import { released } from "@/lib/schedule";
import { useFaceDown } from "@/lib/sealed";
import { cn, EYEBROW, FOCUS, HEADING } from "@/lib/ui";
import { getMyGroups, type Group } from "@armchair/app-core/api/groups";
import { useNow } from "@armchair/app-core/show/use-now";

const SHORT: Record<EventType, string> = { MURDER: "Murder", RT: "Banish", RECRUIT: "Recruit" };
const ORDER: EventType[] = ["MURDER", "RT", "RECRUIT"];
const ME = "";

type Load = { kind: "loading" } | { kind: "ready"; people: PersonRecord[] } | { kind: "error"; message: string };

/**
 * Who you and your friends or a group picked, episode by episode, and how it scored:
 * who each person usually backs, accuracy by decision, points over time, head to head.
 * An episode still face down on this device shows only your own picks: no points, nobody else's.
 */
export function PicksScreen() {
  const { view } = useSeasonView();
  const name = useSeasonName(view.season, view.title);
  const faceDown = useFaceDown(view.season);
  const [groups, setGroups] = useState<Group[]>([]);
  const [scope, setScope] = useState<string>(FRIENDS);
  const [chosen, setChosen] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<{ key: string; value: Load } | null>(null);
  const key = `${view.season}|${scope}|${attempt}`;

  useEffect(() => {
    let cancelled = false;
    getMyGroups().then(
      (g) => !cancelled && setGroups(g),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getRecord(view.season, scope || null).then(
      (r) => !cancelled && setLoad({ key, value: { kind: "ready", people: r.people } }),
      (e: unknown) => !cancelled && setLoad({ key, value: { kind: "error", message: errorText(e) } }),
    );
    return () => {
      cancelled = true;
    };
  }, [view.season, scope, key]);

  const current = load?.key === key ? load.value : { kind: "loading" as const };
  const now = useNow();
  const eps = view.episodes.filter((e) => released(e, now)).map((e) => e.ep);

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className={EYEBROW}>{name.title}</p>
        <h1 className={cn(HEADING, "text-2xl")}>Picks</h1>
      </div>
      <Select
        label="Whose picks"
        value={scope}
        options={[
          { value: ME, label: "Just you" },
          { value: FRIENDS, label: "You and your friends" },
          ...groups.map((g) => ({ value: g.id, label: `${g.name} (${g.members.length})` })),
        ]}
        onChange={(v) => {
          setScope(v);
          setChosen(null);
        }}
      />
      {faceDown.eps.length > 0 && (
        <FaceDownNotice season={view.season} ep={faceDown.eps[0]} what="Points and everyone else's calls" />
      )}
      {current.kind === "loading" && <SkeletonList label="Reading everyone's calls" rows={4} row="h-20" />}
      {current.kind === "error" && (
        <ErrorState what="the picks" message={current.message} retry={() => setAttempt((n) => n + 1)} />
      )}
      {current.kind === "ready" && (
        <Breakdown
          season={view.season}
          eps={eps}
          people={current.people.map((p) => hideFaceDown(p, faceDown.episode))}
          chosen={chosen}
          onChoose={setChosen}
          players={view.cast}
        />
      )}
    </>
  );
}

/** Face-down episodes keep only your own picks, with nothing about how they scored. */
function hideFaceDown(p: PersonRecord, down: (ep: number) => boolean): PersonRecord {
  const calls = p.calls.flatMap((c) => {
    if (!down(c.ep)) return [c];
    if (!p.me) return [];
    return [{ ep: c.ep, type: c.type, picks: c.picks, forfeit: c.forfeit }];
  });
  return { ...p, calls };
}

interface BreakdownProps {
  season: string;
  eps: number[];
  people: PersonRecord[];
  chosen: string | null;
  onChoose: (sub: string) => void;
  players: { id: string; name: string; headshot: string | null }[];
}

function Breakdown({ season, eps, people, chosen, onChoose, players }: BreakdownProps) {
  const me = people.find((p) => p.me);
  const person = people.find((p) => p.sub === chosen) ?? me ?? people[0];
  if (!person) return null;
  const others = people.filter((p) => !p.me);

  return (
    <>
      {people.length > 1 && <Compare people={people} me={me} chosen={person.sub} onChoose={onChoose} />}
      {people.length > 1 && others.length === 0 && (
        <p className="text-ash">Nobody else here has made a call you can see yet.</p>
      )}
      <section aria-labelledby="person-title" className="flex flex-col gap-4">
        <h2 id="person-title" className="flex items-center gap-3 font-display text-xl text-bone">
          <Avatar name={person.name} picture={person.picture} size={40} />
          {person.me ? "Your season" : `${person.name ?? "Someone"}'s season`}
        </h2>
        {person.calls.length === 0 && !person.winner ? (
          <EmptyState title="No calls to show">
            {person.me
              ? "Your calls show here once you make them."
              : "Their calls show here for each event once you've made your own call on it."}
          </EmptyState>
        ) : (
          <>
            <Accuracy calls={person.calls} />
            {!person.me && me && <VsMe me={me} them={person} />}
            <Trend eps={eps} person={person} me={person.me ? null : me ?? null} />
            <Winners season={season} person={person} players={players} />
            <Usual season={season} calls={person.calls} players={players} />
            <Timeline season={season} calls={person.calls} players={players} you={person.me} />
          </>
        )}
      </section>
    </>
  );
}

const pct = (r: Rate) => {
  const p = percent(r);
  return p === null ? "–" : `${p}%`;
};

/** Everyone side by side: points, then accuracy by decision. Tap a row for their season. */
function Compare({
  people,
  me,
  chosen,
  onChoose,
}: {
  people: PersonRecord[];
  me: PersonRecord | undefined;
  chosen: string;
  onChoose: (sub: string) => void;
}) {
  const rows = [...people].sort((a, b) => total(b.calls) - total(a.calls));
  return (
    <Card as="section" aria-labelledby="compare-title" className="flex flex-col gap-2 overflow-x-auto">
      <h2 id="compare-title" className={EYEBROW}>
        Side by side
      </h2>
      <table className="w-full min-w-[30rem] text-left">
        <caption className="sr-only">Points and accuracy for each person</caption>
        <thead>
          <tr className="font-display text-xs tracking-[0.12em] text-ash uppercase">
            <th scope="col" className="py-1.5 font-normal">
              Who
            </th>
            <th scope="col" className="py-1.5 text-right font-normal">
              Pts
            </th>
            <th scope="col" className="py-1.5 text-right font-normal">
              Banish
            </th>
            <th scope="col" className="py-1.5 text-right font-normal">
              Top 3
            </th>
            <th scope="col" className="py-1.5 text-right font-normal">
              Murder
            </th>
            <th scope="col" className="py-1.5 text-right font-normal">
              Recruit
            </th>
            <th scope="col" className="py-1.5 text-right font-normal">
              Vs you
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const a = accuracy(p.calls);
            const h = me && !p.me ? headToHead(me.calls, p.calls) : null;
            return (
              <tr key={p.sub} className={cn("border-t border-bone/10", p.sub === chosen && "bg-cloak/50")}>
                <th scope="row" className="py-1.5 font-normal">
                  <button
                    type="button"
                    aria-pressed={p.sub === chosen}
                    onClick={() => onChoose(p.sub)}
                    className={cn(FOCUS, "flex items-center gap-2 rounded-sm text-left text-bone hover:text-candle")}
                  >
                    <Avatar name={p.name} picture={p.picture} size={28} />
                    <span className="max-w-32 truncate">{p.me ? "You" : (p.name ?? "Someone")}</span>
                  </button>
                </th>
                <td className="py-1.5 text-right font-display font-semibold text-candle nums">{total(p.calls)}</td>
                <td className="py-1.5 text-right text-parchment nums">{pct(a.banish)}</td>
                <td className="py-1.5 text-right text-parchment nums">{pct(a.top3)}</td>
                <td className="py-1.5 text-right text-parchment nums">{pct(a.murder)}</td>
                <td className="py-1.5 text-right text-parchment nums">{pct(a.recruit)}</td>
                <td className="py-1.5 text-right text-ash nums">{h ? `${h.wins}-${h.losses}-${h.ties}` : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-sm text-ash">Vs you is wins, losses and ties on calls you both made.</p>
    </Card>
  );
}

function Accuracy({ calls }: { calls: RecordCall[] }) {
  const a = accuracy(calls);
  const cells: [string, Rate][] = [
    ["Banishment called", a.banish],
    ["Slate in the top 3", a.top3],
    ["Murder called", a.murder],
    ["Recruit called", a.recruit],
  ];
  return (
    <Card tartan className="flex flex-col gap-3">
      <p className="flex items-baseline gap-3">
        <span className="font-display text-4xl font-semibold text-candle nums">{total(calls)}</span>
        <span className="text-ash">points from calls</span>
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cells.map(([label, r]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-sm text-ash">{label}</dt>
            <dd className="font-display text-2xl text-bone nums">
              {pct(r)}
              <span className="ml-1.5 text-sm text-ash">
                {r.hits}/{r.of}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function VsMe({ me, them }: { me: PersonRecord; them: PersonRecord }) {
  const h = headToHead(me.calls, them.calls);
  const played = h.wins + h.losses + h.ties;
  return (
    <Card as="section" aria-labelledby="h2h-title" className="flex flex-col gap-1">
      <h3 id="h2h-title" className={EYEBROW}>
        You against {them.name ?? "them"}
      </h3>
      {played === 0 ? (
        <p className="text-ash">No call you&apos;ve both made has a result yet.</p>
      ) : (
        <p className="text-lg text-bone">
          You won <span className="nums text-candle">{h.wins}</span>, lost <span className="nums">{h.losses}</span>, tied{" "}
          <span className="nums">{h.ties}</span> of <span className="nums">{played}</span> calls,{" "}
          <span className="nums">
            {h.margin >= 0 ? "+" : ""}
            {h.margin}
          </span>{" "}
          points between you.
        </p>
      )}
    </Card>
  );
}

/** The running total by episode, theirs against yours. */
function Trend({ eps, person, me }: { eps: number[]; person: PersonRecord; me: PersonRecord | null }) {
  const lines = [{ who: person, color: "var(--candle)" }, ...(me ? [{ who: me, color: "var(--parchment)" }] : [])].map(
    (l) => ({ ...l, series: pointsOverTime(l.who.calls, eps) }),
  );
  const top = Math.max(1, ...lines.flatMap((l) => l.series.map((s) => s.total)));
  const W = 320;
  const H = 120;
  const x = (i: number) => (eps.length > 1 ? (i / (eps.length - 1)) * W : W / 2);
  const y = (v: number) => H - (v / top) * H;
  const name = (p: PersonRecord) => (p.me ? "You" : (p.name ?? "Them"));
  return (
    <section aria-labelledby="trend-title" className="flex flex-col gap-2">
      <h3 id="trend-title" className={EYEBROW}>
        Points over time
      </h3>
      <svg
        viewBox={`-8 -8 ${W + 16} ${H + 28}`}
        role="img"
        aria-label={lines
          .map((l) => `${name(l.who)}: ${l.series.map((s) => `after episode ${s.ep}, ${s.total}`).join(", ")}`)
          .join(". ")}
        className="w-full max-w-xl"
      >
        <line x1={0} y1={H} x2={W} y2={H} stroke="var(--gilt)" strokeOpacity={0.4} />
        {lines.map((l) => (
          <polyline
            key={l.who.sub}
            fill="none"
            stroke={l.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            points={l.series.map((s, i) => `${x(i)},${y(s.total)}`).join(" ")}
          />
        ))}
        {eps.map((ep, i) => (
          <text key={ep} x={x(i)} y={H + 18} textAnchor="middle" fontSize={11} fill="var(--ash)">
            {ep}
          </text>
        ))}
      </svg>
      <p className="flex flex-wrap gap-4 text-sm text-ash">
        {lines.map((l) => (
          <span key={l.who.sub} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-0.5 w-5" style={{ background: l.color }} />
            {name(l.who)} · <span className="nums text-bone">{l.series.at(-1)?.total ?? 0}</span>
          </span>
        ))}
      </p>
    </section>
  );
}

function Winners({ season, person, players }: { season: string; person: PersonRecord; players: BreakdownProps["players"] }) {
  if (!person.winner) {
    if (person.me) return null;
    return <p className="text-ash">Their winner picks show once your top 3 is complete.</p>;
  }
  return (
    <section aria-labelledby="winners-title" className="flex flex-col gap-2">
      <h3 id="winners-title" className={EYEBROW}>
        Winner picks
      </h3>
      <ol className="flex flex-wrap gap-x-5 gap-y-2">
        {person.winner.map((w, i) => (
          <li key={w.player} className="flex items-center gap-2">
            <span className="font-display text-gilt">{roman(i + 1)}</span>
            <PlayerChip player={playerOf(w.player, players)} href={seasonPlayerHref(season)(w.player)} size={28} />
            <span className="text-sm text-ash">as a {w.faction}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const USUAL = 6;

function Usual({ season, calls, players }: { season: string; calls: RecordCall[]; players: BreakdownProps["players"] }) {
  const rows = mostPicked(calls).slice(0, USUAL);
  if (rows.length === 0) return null;
  const top = rows[0].count;
  return (
    <section aria-labelledby="usual-title" className="flex flex-col gap-2">
      <h3 id="usual-title" className={EYEBROW}>
        Picked most
      </h3>
      <ol className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.player} className="flex flex-col gap-1">
            <span className="flex items-center justify-between gap-3">
              <PlayerChip player={playerOf(r.player, players)} href={seasonPlayerHref(season)(r.player)} size={26} />
              <span className="text-sm text-ash">
                <span className="nums text-bone">{r.count}</span>×{" "}
                {ORDER.filter((k) => r.by[k])
                  .map((k) => `${SHORT[k].toLowerCase()} ${r.by[k]}`)
                  .join(" · ")}
              </span>
            </span>
            <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-night">
              <span className="block h-full rounded-full bg-gilt/70" style={{ width: `${(r.count / top) * 100}%` }} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Who they chose, when: every episode's calls with what each pick scored. */
function Timeline({
  season,
  calls,
  players,
  you,
}: {
  season: string;
  calls: RecordCall[];
  players: BreakdownProps["players"];
  you: boolean;
}) {
  const eps = [...new Set(calls.map((c) => c.ep))].sort((a, b) => b - a);
  if (eps.length === 0) return null;
  return (
    <section aria-labelledby="timeline-title" className="flex flex-col gap-2">
      <h3 id="timeline-title" className={EYEBROW}>
        Who {you ? "you" : "they"} chose, episode by episode
      </h3>
      <ol className="flex flex-col gap-2">
        {eps.map((ep) => {
          const these = ORDER.flatMap((k) => calls.filter((c) => c.ep === ep && c.type === k));
          const scored = these.some((c) => c.points !== undefined);
          return (
            <li key={ep} className="rounded-sm border border-gilt/25 bg-stone/80 p-3">
              <p className="mb-2 flex items-baseline justify-between font-display text-bone">
                Episode {ep}
                {scored && <span className="text-candle nums">+{total(these)}</span>}
              </p>
              <dl className="flex flex-col gap-1.5">
                {these.map((c) => (
                  <div key={c.type} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <dt className="w-16 font-display text-xs tracking-[0.12em] text-ash uppercase">{SHORT[c.type]}</dt>
                    <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {c.picks ? (
                        c.picks.map((p, i) => {
                          const call = c.calls?.[i];
                          const who = playerOf(p, players);
                          return (
                            <span key={p} className="inline-flex items-center gap-1">
                              {c.type === "RT" && <span className="font-display text-xs text-gilt">{roman(i + 1)}</span>}
                              <span aria-hidden="true" className="inline-flex">
                                <Headshot name={who.name} image={who.headshot} size={20} round />
                              </span>
                              <a href={seasonPlayerHref(season)(p)} className={cn(FOCUS, "rounded-sm text-bone hover:text-candle")}>
                                {firstName(who.name)}
                              </a>
                              {call && (
                                <span className={cn("text-xs", call.points > 0 ? "text-candle" : "text-ash")}>
                                  {call.points > 0 ? `+${call.points}` : WHY[call.why]}
                                </span>
                              )}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-ash italic">no pick</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
