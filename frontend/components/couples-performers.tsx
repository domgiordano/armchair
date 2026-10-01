"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";

import { CoupleNames, PersonLink } from "@/components/couple-names";
import { CoupleAvatars, Headshot } from "@/components/headshot";
import { formatScore } from "@/components/performance-card";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import {
  ALL_SEASONS,
  getPerformers,
  type CoupleDance,
  type CoupleStats,
  type Crowd,
  type PersonStats,
  type Performers,
} from "@/lib/api/couples";
import type { Season } from "@/lib/api/show";
import { COUPLE_SORTS, gapTone, signed, sortCouples, type CoupleSort, type GapTone } from "@/lib/show/couples";
import { personSlug } from "@/lib/show/people";
import { seasonLabel } from "@/lib/show/seasons";
import { button, cn, EYEBROW, FOCUS } from "@/lib/ui";

type Load = { kind: "loading" } | { kind: "ready"; data: Performers } | { kind: "error"; message: string };

const TEXT_TONE: Record<GapTone, string> = { over: "text-gold-light", under: "text-sky-200", level: "text-pearl" };

const TONE: Record<GapTone, string> = {
  over: "border-gold/40 bg-gold/10 text-gold-light",
  under: "border-sky-300/40 bg-sky-400/10 text-sky-200",
  level: "border-silver/20 bg-silver/5 text-silver",
};

const avg = (n: number | null) => (n === null ? "–" : formatScore(n));

export function PerformersView({ season, group }: { season: Season; group: string | null }) {
  const [range, setRange] = useState<"season" | "all">("season");
  const [sort, setSort] = useState<CoupleSort>("you");
  const asked = range === "all" ? ALL_SEASONS : season.season;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:flex md:max-w-xl">
        <Select
          label="Seasons"
          className="md:w-48"
          value={range}
          options={[
            { value: "season", label: seasonLabel(season.season) },
            { value: "all", label: "Every season" },
          ]}
          onChange={(v) => setRange(v as "season" | "all")}
        />
        <Select label="Sort by" className="md:w-56" value={sort} options={COUPLE_SORTS} onChange={(v) => setSort(v as CoupleSort)} />
      </div>
      <PerformersFetcher key={`${asked}|${group}`} season={asked} group={group} sort={sort} />
    </>
  );
}

function PerformersFetcher({ season, group, sort }: { season: string; group: string | null; sort: CoupleSort }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPerformers(season, group).then(
      (data) => !cancelled && setLoad({ kind: "ready", data }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: e instanceof Error ? e.message : "Request failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [season, group, attempt]);

  if (load.kind === "loading") return <PerformersSkeleton />;
  if (load.kind === "error") {
    const retry = () => {
      setLoad({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return <ErrorState what="your couples" message={load.message} retry={retry} />;
  }

  const { data } = load;
  if (data.couples.length === 0) {
    return (
      <EmptyState
        title="No couples to compare yet"
        action={
          <Link href="/episode/" className={button("primary", "sm")}>
            Score a dance
          </Link>
        }
      >
        Every dance you score lands here: your average for each couple, the judges&apos;, and where you and they part ways.
      </EmptyState>
    );
  }

  const byRef = new Map(data.couples.map((c) => [c.ref, c]));
  const pick = (refs: string[]) => refs.flatMap((r) => byRef.get(r) ?? []);
  const multi = data.season === ALL_SEASONS;
  const selected = open ? byRef.get(open) : undefined;
  const returning = data.celebrities.filter((c) => c.couples > 1);

  return (
    <>
      <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Highlight title="Your favorites" couples={pick(data.favorites)} value={(c) => avg(c.you)} onOpen={setOpen} />
        <Highlight
          title="You're softer on"
          note="Higher than the judges"
          couples={pick(data.softerOn)}
          value={(c) => signed(c.gap ?? 0)}
          tone="over"
          onOpen={setOpen}
        />
        <Highlight
          title="You're tougher on"
          note="Lower than the judges"
          couples={pick(data.tougherOn)}
          value={(c) => signed(c.gap ?? 0)}
          tone="under"
          onOpen={setOpen}
        />
        <Highlight title="Least favorites" couples={pick(data.leastFavorites)} value={(c) => avg(c.you)} onOpen={setOpen} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:items-start">
        <section aria-labelledby="every-couple" className="flex flex-col gap-2">
          <h2 id="every-couple" className={EYEBROW}>
            Every couple you&apos;ve scored · {data.couples.length}
          </h2>
          <ol className="stagger flex flex-col gap-2">
            {sortCouples(data.couples, sort).map((c, i) => (
              <CoupleRow key={c.ref} couple={c} place={i + 1} multi={multi} onOpen={() => setOpen(c.ref)} />
            ))}
          </ol>
        </section>
        <div className="flex flex-col gap-4 lg:sticky lg:top-32">
          <PeopleCard
            id="by-pro"
            title={multi ? "Pros, every season" : "Pros"}
            note="Your average with each pro against the judges'."
            people={data.pros}
          />
          {multi && returning.length > 0 && (
            <PeopleCard id="returning" title="Returning stars" note="Celebrities you've scored in more than one season." people={returning} />
          )}
        </div>
      </div>

      <Sheet open={selected !== undefined} onClose={() => setOpen(null)} label={selected ? coupleTitle(selected) : "Couple"}>
        {selected && <CoupleDetail couple={selected} />}
      </Sheet>
    </>
  );
}

const coupleTitle = (c: CoupleStats) => c.members.map((m) => m.name).join(" & ");

function GapPill({ gap }: { gap: number | null }) {
  const tone = gapTone(gap);
  const label = gap === null ? "No judges yet" : tone === "level" ? "Level with the judges" : `${tone === "over" ? "Over" : "Under"} the judges by ${Math.abs(gap).toFixed(1)}`;
  return (
    <span
      title={label}
      className={cn("inline-flex min-w-12 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums", TONE[tone])}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">{gap === null ? "–" : signed(gap)}</span>
    </span>
  );
}

/** A bar out from the centre: right in gold when you score higher than the judges, left in blue when lower. */
function GapBar({ gap, delay }: { gap: number | null; delay: number }) {
  if (gap === null) return <span aria-hidden="true" className="block h-1.5" />;
  const width = Math.min(50, (Math.abs(gap) / 3) * 50);
  const over = gap > 0;
  return (
    <span aria-hidden="true" className="relative block h-1.5 overflow-hidden rounded-full bg-silver/10">
      <span className="absolute inset-y-0 left-1/2 w-px bg-silver/40" />
      <span
        className={cn("grow-x absolute inset-y-0 rounded-full", over ? "left-1/2 bg-gradient-to-r from-gold-deep to-gold-light" : "right-1/2 bg-gradient-to-l from-sky-500 to-sky-200")}
        style={{ width: `${Math.max(1.5, width)}%`, transformOrigin: over ? "left" : "right", "--d": `${200 + delay}ms` } as CSSProperties}
      />
    </span>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5 sm:items-end">
      <span className="text-[11px] tracking-[0.08em] text-silver-dim uppercase">{label}</span>
      <span className="text-base font-semibold text-pearl tabular-nums">{value}</span>
      {detail && <span className="sr-only">{detail}</span>}
    </span>
  );
}

const crowdDetail = (c: Crowd) => (c.mean === null ? `${c.raters} scored, needs 2 to show` : `${c.raters} scored`);

function CoupleRow({ couple: c, place, multi, onOpen }: { couple: CoupleStats; place: number; multi: boolean; onOpen: () => void }) {
  return (
    <li
      onClick={onOpen}
      className="group flex cursor-pointer flex-col gap-3 rounded-xl border border-silver/10 bg-ballroom/45 p-3 transition-colors hover:border-silver/25 hover:bg-ballroom/70 sm:p-4"
    >
      <div className="flex items-center gap-3">
        <span className="w-5 shrink-0 text-right text-sm font-semibold text-silver-dim tabular-nums">{place}</span>
        <CoupleAvatars members={c.members} size={40} />
        <span className="flex min-w-0 flex-1 flex-col">
          <CoupleNames members={c.members} className="truncate font-medium text-pearl" />
          <span className="truncate text-xs text-silver-dim">
            {c.dances} {c.dances === 1 ? "dance" : "dances"}
            {multi && ` · ${seasonLabel(c.season)}`}
          </span>
        </span>
        <span className="hidden sm:block">
          <GapPill gap={c.gap} />
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          aria-label={`Details for ${coupleTitle(c)}`}
          className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-silver-dim transition-colors group-hover:text-gold-light hover:bg-silver/10", FOCUS)}
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-5 gap-1 sm:grid-cols-4 sm:pl-8">
        <Metric label="You" value={avg(c.you)} />
        <Metric label="Judges" value={avg(c.judges)} />
        <span className="flex flex-col items-center gap-1 sm:hidden">
          <span className="text-[11px] tracking-[0.08em] text-silver-dim uppercase">Gap</span>
          <GapPill gap={c.gap} />
        </span>
        <Metric label="Friends" value={avg(c.friends.mean)} detail={crowdDetail(c.friends)} />
        <Metric label="Everyone" value={avg(c.everyone.mean)} detail={crowdDetail(c.everyone)} />
      </div>
      <div className="sm:pl-8">
        <GapBar gap={c.gap} delay={Math.min(place, 12) * 45} />
      </div>
    </li>
  );
}

function Highlight({
  title,
  note,
  couples,
  value,
  tone,
  onOpen,
}: {
  title: string;
  note?: string;
  couples: CoupleStats[];
  value: (c: CoupleStats) => string;
  tone?: GapTone;
  onOpen: (ref: string) => void;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-xl border p-4",
        tone === "over" ? "border-gold/30 bg-gradient-to-br from-gold/10 to-ink" : tone === "under" ? "border-sky-300/25 bg-gradient-to-br from-sky-400/10 to-ink" : "border-silver/10 bg-ballroom/45",
      )}
    >
      <div className="flex flex-col">
        <h3 className="text-xs font-semibold tracking-[0.16em] text-gold uppercase">{title}</h3>
        {note && <p className="text-xs text-silver-dim">{note}</p>}
      </div>
      {couples.length === 0 ? (
        <p className="text-sm text-silver-dim">{tone ? "Nobody yet. You and the judges agree." : "Score a few more couples."}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {couples.map((c) => (
            <li key={c.ref}>
              <button
                type="button"
                onClick={() => onOpen(c.ref)}
                className={cn("flex w-full items-center gap-2.5 rounded-lg text-left transition-colors hover:bg-silver/5", FOCUS)}
              >
                <CoupleAvatars members={c.members} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm text-pearl">
                  {c.members.find((m) => m.role === "celebrity")?.name ?? coupleTitle(c)}
                </span>
                <span className={cn("text-sm font-semibold tabular-nums", TEXT_TONE[tone ?? "level"])}>{value(c)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function PeopleCard({ id, title, note, people }: { id: string; title: string; note: string; people: PersonStats[] }) {
  return (
    <Card id={id} title={title} note={note}>
      <ul className="flex flex-col divide-y divide-silver/10">
        {people.map((p) => (
          <li key={p.name} className="flex items-center gap-3 py-2.5">
            <Headshot person={p} size={36} />
            <span className="flex min-w-0 flex-1 flex-col">
              <PersonLink id={personSlug(p.name)} name={p.name} className="truncate text-sm font-medium text-pearl" />
              <span className="truncate text-xs text-silver-dim">
                {p.dances} {p.dances === 1 ? "dance" : "dances"}
                {p.seasons.length > 1 && ` · ${p.seasons.length} seasons`}
              </span>
            </span>
            <span className="text-sm font-semibold text-pearl tabular-nums">{avg(p.you)}</span>
            <GapPill gap={p.gap} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CoupleDetail({ couple: c }: { couple: CoupleStats }) {
  const tone = gapTone(c.gap);
  return (
    <>
      <div className="flex items-center gap-3 pr-10">
        <CoupleAvatars members={c.members} size={56} />
        <div className="flex min-w-0 flex-col">
          <CoupleNames members={c.members} className="text-lg leading-snug font-semibold text-pearl" />
          <span className="text-xs text-silver-dim">
            {seasonLabel(c.season)} · {c.dances} {c.dances === 1 ? "dance" : "dances"} scored
          </span>
        </div>
      </div>

      <p className="text-sm text-silver">
        {c.gap === null
          ? "The judges haven't confirmed these scores yet."
          : tone === "level"
            ? "You and the judges see this couple the same way."
            : `You ${tone === "over" ? "overrate" : "underrate"} them by ${Math.abs(c.gap).toFixed(1)} a dance against the judges.`}
      </p>

      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Tile term="You" value={avg(c.you)} accent />
        <Tile term="Judges" value={avg(c.judges)} />
        <Tile term="Gap" value={c.gap === null ? "–" : signed(c.gap)} tone={tone} />
        <Tile term="Friends" value={avg(c.friends.mean)} detail={c.friends.mean === null ? "need 2" : `${c.friends.raters} scored`} />
        <Tile term="Everyone" value={avg(c.everyone.mean)} detail={c.everyone.mean === null ? "need 2" : `${c.everyone.raters} scored`} />
      </dl>

      {c.weeks.length > 0 && (
        <section aria-label="Week by week" className="flex flex-col gap-2">
          <h3 className={EYEBROW}>Week by week</h3>
          <WeekChart dances={c.weeks} />
          <p className="flex gap-4 text-xs text-silver-dim">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-gold" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-silver-dim" />
              Judges&apos; average
            </span>
          </p>
        </section>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <DanceLine title="Your best" dance={c.best} />
        {c.dances > 1 && <DanceLine title="Your lowest" dance={c.worst} />}
      </div>
    </>
  );
}

function Tile({ term, value, detail, accent, tone }: { term: string; value: string; detail?: string; accent?: boolean; tone?: GapTone }) {
  return (
    <div className={cn("flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2", tone ? TONE[tone] : accent ? "border-gold/30 bg-gold/5" : "border-silver/10 bg-ballroom/45")}>
      <dt className="text-[11px] tracking-[0.08em] text-silver-dim uppercase">{term}</dt>
      <dd className={cn("text-xl font-semibold tabular-nums", accent ? "text-gold-light" : tone ? "" : "text-pearl")}>{value}</dd>
      {detail && <dd className="text-[11px] text-silver-dim">{detail}</dd>}
    </div>
  );
}

const weekLabel = (d: CoupleDance) => (d.week === null ? `Ep ${d.ep}` : `W${d.week}`);

function DanceLine({ title, dance: d }: { title: string; dance: CoupleDance }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-silver/10 bg-ballroom/40 px-3 py-2">
      <span className="text-[11px] tracking-[0.08em] text-silver-dim uppercase">{title}</span>
      <span className="text-sm text-pearl">
        {d.week === null ? `Episode ${d.ep}` : `Week ${d.week}`}
        {d.style && ` · ${d.style}`}
      </span>
      <span className="text-xs text-silver-dim tabular-nums">
        You {d.paddle} · judges {d.judges === null ? "pending" : formatScore(d.judges)}
      </span>
    </div>
  );
}

const W = 320;
const H = 150;
const PAD = { left: 22, right: 10, top: 10, bottom: 20 };

/** Your paddle and the judges' mean on each of the couple's dances, on a fixed 1-10 scale. */
export function WeekChart({ dances }: { dances: CoupleDance[] }) {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (dances.length === 1 ? plotW / 2 : (i * plotW) / (dances.length - 1));
  const y = (v: number) => PAD.top + ((10 - v) * plotH) / 9;
  const judged = dances.map((d, i) => ({ d, i })).filter(({ d }) => d.judges !== null);
  const at = (i: number) => `${250 + (i / Math.max(1, dances.length - 1)) * 900}ms`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Your paddle and the judges' average: ${dances
        .map((d) => `${weekLabel(d)} you ${d.paddle}, judges ${d.judges === null ? "pending" : formatScore(d.judges)}`)
        .join("; ")}`}
      className="w-full text-silver-dim"
    >
      {[2, 4, 6, 8, 10].map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.18} />
          <text x={PAD.left - 5} y={y(v)} dy="0.35em" textAnchor="end" fontSize={9} fill="currentColor">
            {v}
          </text>
        </g>
      ))}
      {dances.map((d, i) => (
        <text
          key={`${d.ep}-${d.key}`}
          x={x(i)}
          y={H - 5}
          fontSize={9}
          fill="currentColor"
          textAnchor={dances.length > 1 && i === 0 ? "start" : dances.length > 1 && i === dances.length - 1 ? "end" : "middle"}
        >
          {weekLabel(d)}
        </text>
      ))}
      {/* The gap on each dance, as a stem from the judges' mean to your paddle. */}
      {judged.map(({ d, i }) => (
        <line
          key={`gap-${d.ep}-${d.key}`}
          x1={x(i)}
          x2={x(i)}
          y1={y(d.judges ?? 0)}
          y2={y(d.paddle)}
          stroke={d.paddle >= (d.judges ?? 0) ? "var(--color-gold)" : "rgb(125 211 252)"}
          strokeOpacity={0.45}
          strokeWidth={3}
          strokeLinecap="round"
          className="animate-fade-in"
          style={{ animationDelay: at(i) }}
        />
      ))}
      {judged.length > 1 && (
        <polyline
          points={judged.map(({ d, i }) => `${x(i)},${y(d.judges ?? 0)}`).join(" ")}
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="draw"
        />
      )}
      {judged.map(({ d, i }) => (
        <circle key={`j-${d.ep}-${d.key}`} cx={x(i)} cy={y(d.judges ?? 0)} r={2.5} fill="currentColor" className="pop" style={{ "--d": at(i) } as CSSProperties} />
      ))}
      {dances.length > 1 && (
        <polyline
          points={dances.map((d, i) => `${x(i)},${y(d.paddle)}`).join(" ")}
          pathLength={1}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth={2}
          strokeLinejoin="round"
          className="draw"
          style={{ "--d": "250ms" } as CSSProperties}
        />
      )}
      {dances.map((d, i) => (
        <circle
          key={`y-${d.ep}-${d.key}`}
          cx={x(i)}
          cy={y(d.paddle)}
          r={3.5}
          fill="var(--color-gold)"
          stroke="var(--color-ink)"
          strokeWidth={1.5}
          className="pop"
          style={{ "--d": at(i) } as CSSProperties}
        >
          <title>{`${weekLabel(d)}${d.style ? ` ${d.style}` : ""}: you ${d.paddle}, judges ${d.judges === null ? "pending" : formatScore(d.judges)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function PerformersSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Loading your couples...</span>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}
