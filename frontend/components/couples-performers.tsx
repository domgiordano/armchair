"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

import { CoupleLink, CoupleNames, PersonLink } from "@/components/couple-names";
import { EliminatedStamp, OUT_FADE, OUT_STRIKE, ShowEliminated } from "@/components/eliminated";
import { CoupleAvatars, Headshot } from "@/components/headshot";
import { formatScore } from "@/components/performance-card";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import {
  ALL_SEASONS,
  getPerformers,
  type CoupleStats,
  type Crowd,
  type PersonStats,
  type Performers,
} from "@/lib/api/couples";
import type { Season } from "@/lib/api/show";
import { COUPLE_SORTS, gapTone, signed, sortCouples, type CoupleSort, type GapTone } from "@/lib/show/couples";
import { eliminatedLast, highlights, useShowEliminated } from "@/lib/show/eliminated";
import { coupleHref, personSlug } from "@/lib/show/people";
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
  const [showOut, setShowOut] = useShowEliminated("performers");

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

  const multi = data.season === ALL_SEASONS;
  const returning = data.celebrities.filter((c) => c.couples > 1);
  const gone = data.couples.filter((c) => c.eliminated).length;
  const list = eliminatedLast(sortCouples(data.couples, sort), (c) => Boolean(c.eliminated), showOut);
  const top = highlights(showOut ? data.couples : list);

  return (
    <>
      <ShowEliminated checked={showOut} onChange={setShowOut} count={gone} />
      <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Highlight title="Your favorites" couples={top.favorites} value={(c) => avg(c.you)} />
        <Highlight
          title="You're softer on"
          note="Higher than the judges"
          couples={top.softerOn}
          value={(c) => signed(c.gap ?? 0)}
          tone="over"
        />
        <Highlight
          title="You're tougher on"
          note="Lower than the judges"
          couples={top.tougherOn}
          value={(c) => signed(c.gap ?? 0)}
          tone="under"
        />
        <Highlight title="Least favorites" couples={top.leastFavorites} value={(c) => avg(c.you)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:items-start">
        <section aria-labelledby="every-couple" className="flex flex-col gap-2">
          <h2 id="every-couple" className={EYEBROW}>
            Every couple you&apos;ve scored · {list.length}
          </h2>
          {list.length === 0 ? (
            <EmptyState compact title="Everyone you scored has gone home">
              Switch on Show eliminated to see them.
            </EmptyState>
          ) : (
            <ol className="stagger flex flex-col gap-2">
              {list.map((c, i) => (
                <CoupleRow key={c.ref} couple={c} place={i + 1} multi={multi} />
              ))}
            </ol>
          )}
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

/** The whole row opens the couple's page; the chevron is the link a keyboard reaches. */
function CoupleRow({ couple: c, place, multi }: { couple: CoupleStats; place: number; multi: boolean }) {
  const router = useRouter();
  const out = c.eliminated;
  const href = coupleHref(c.members, c.season);
  return (
    <li
      onClick={() => router.push(href)}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-3 rounded-xl border p-3 transition-colors sm:p-4",
        out
          ? "border-dashed border-silver/15 bg-ink/40 hover:border-silver/30"
          : "border-silver/10 bg-ballroom/45 hover:border-silver/25 hover:bg-ballroom/70",
      )}
    >
      {out && <EliminatedStamp out={out} size="sm" className="absolute top-5 left-2 z-10 sm:top-6 sm:left-4" />}
      <div className="flex items-center gap-3">
        <span className={cn("w-5 shrink-0 text-right text-sm font-semibold text-silver-dim tabular-nums", out && "opacity-55")}>{place}</span>
        <span className={cn("shrink-0", out && OUT_FADE)}>
          <CoupleLink members={c.members} season={c.season} size={40} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <CoupleNames members={c.members} className={cn("truncate font-medium", out ? cn("text-silver-dim", OUT_STRIKE) : "text-pearl")} />
          <span className="truncate text-xs text-silver-dim">
            {c.dances} {c.dances === 1 ? "dance" : "dances"}
            {multi && ` · ${seasonLabel(c.season)}`}
          </span>
        </span>
        <span className="hidden sm:block">
          <GapPill gap={c.gap} />
        </span>
        <Link
          href={href}
          prefetch={false}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Details for ${coupleTitle(c)}`}
          className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-silver-dim transition-colors group-hover:text-gold-light hover:bg-silver/10", FOCUS)}
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>
      </div>
      <div className={cn("grid grid-cols-5 gap-1 sm:grid-cols-4 sm:pl-8", out && OUT_FADE)}>
        <Metric label="You" value={avg(c.you)} />
        <Metric label="Judges" value={avg(c.judges)} />
        <span className="flex flex-col items-center gap-1 sm:hidden">
          <span className="text-[11px] tracking-[0.08em] text-silver-dim uppercase">Gap</span>
          <GapPill gap={c.gap} />
        </span>
        <Metric label="Friends" value={avg(c.friends.mean)} detail={crowdDetail(c.friends)} />
        <Metric label="Everyone" value={avg(c.everyone.mean)} detail={crowdDetail(c.everyone)} />
      </div>
      <div className={cn("sm:pl-8", out && OUT_FADE)}>
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
}: {
  title: string;
  note?: string;
  couples: CoupleStats[];
  value: (c: CoupleStats) => string;
  tone?: GapTone;
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
              <Link
                href={coupleHref(c.members, c.season)}
                prefetch={false}
                className={cn("flex w-full items-center gap-2.5 rounded-lg text-left transition-colors hover:bg-silver/5", FOCUS)}
              >
                <span className={cn("shrink-0", c.eliminated && OUT_FADE)}>
                  <CoupleAvatars members={c.members} size={28} />
                </span>
                <span className={cn("min-w-0 flex-1 truncate text-sm", c.eliminated ? cn("text-silver-dim", OUT_STRIKE) : "text-pearl")}>
                  {c.members.find((m) => m.role === "celebrity")?.name ?? coupleTitle(c)}
                </span>
                {c.eliminated && <span className="sr-only">, eliminated</span>}
                <span className={cn("text-sm font-semibold tabular-nums", TEXT_TONE[tone ?? "level"])}>{value(c)}</span>
              </Link>
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
