"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { RosterCards } from "@/components/couples/roster-cards";
import { EliminatedStamp, OUT_FADE, OUT_STRIKE, ShowEliminated } from "@/components/eliminated";
import { coupleName, CoupleAvatars } from "@/components/headshot";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getPerformers } from "@/lib/api/couples";
import { getOverview } from "@/lib/api/overview";
import type { Season } from "@/lib/api/show";
import { eliminatedWhen, useShowEliminated } from "@/lib/show/eliminated";
import { coupleHref } from "@/lib/show/people";
import { ROSTER_SORTS, roster, rosterOrder, scoreLine, type RosterCouple, type RosterSort } from "@/lib/show/roster";
import { cn, FOCUS } from "@/lib/ui";

export type RosterMode = "list" | "cards";

type Load = { kind: "loading" } | { kind: "ready"; couples: RosterCouple[]; aired: boolean } | { kind: "error"; message: string };

export function RosterView({ season, mode }: { season: Season; mode: RosterMode }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [sort, setSort] = useState<RosterSort>("judges");
  const [showOut, setShowOut] = useShowEliminated("couples");

  useEffect(() => {
    let cancelled = false;
    Promise.all([getOverview(season.season), getPerformers(season.season, null)]).then(
      ([overview, performers]) =>
        !cancelled && setLoad({ kind: "ready", couples: roster(season, overview, performers), aired: overview.progress.aired > 0 }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: e instanceof Error ? e.message : "Request failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [season, attempt]);

  if (load.kind === "loading") return <RosterSkeleton mode={mode} />;
  if (load.kind === "error") {
    const retry = () => {
      setLoad({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return <ErrorState what="the couples" message={load.message} retry={retry} />;
  }
  if (load.couples.length === 0) {
    return <EmptyState title="No couples yet">The cast lands here once the season&apos;s lineup is announced.</EmptyState>;
  }

  const list = rosterOrder(load.couples, sort, showOut);
  const gone = load.couples.filter((c) => c.eliminated).length;
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <Select label="Sort by" className="sm:w-56" value={sort} options={ROSTER_SORTS} onChange={(v) => setSort(v as RosterSort)} />
        <ShowEliminated checked={showOut} onChange={setShowOut} count={gone} />
      </div>
      {list.length === 0 ? (
        <EmptyState compact title="Everyone has gone home">
          Switch on Show eliminated to see them.
        </EmptyState>
      ) : mode === "cards" ? (
        <RosterCards key={`${sort}|${showOut}`} couples={list} season={season} aired={load.aired} />
      ) : (
        <ol aria-label="Couples" className="stagger grid grid-cols-1 gap-2 lg:grid-cols-2">
          {list.map((c) => (
            <RosterRow key={c.id} couple={c} season={season} aired={load.aired} />
          ))}
        </ol>
      )}
    </>
  );
}

function RosterRow({ couple: c, season, aired }: { couple: RosterCouple; season: Season; aired: boolean }) {
  const out = c.eliminated;
  const line = scoreLine(c, season, aired);
  return (
    <li>
      <Link
        href={coupleHref(c.members, season.season)}
        prefetch={false}
        className={cn(
          "group relative flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2.5 transition-[background-color,border-color,transform] duration-200 active:scale-[0.99]",
          out
            ? "border-dashed border-silver/15 bg-ink/40 hover:border-silver/30"
            : "border-silver/10 bg-ballroom/45 hover:border-gold/35 hover:bg-ballroom/70",
          FOCUS,
        )}
      >
        <span className={cn("shrink-0", out && OUT_FADE)}>
          <CoupleAvatars members={c.members} size={44} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn("truncate font-medium", out ? cn("text-silver-dim", OUT_STRIKE) : "text-pearl")}>{coupleName(c)}</span>
          <span className={cn("truncate text-xs tabular-nums", c.judges === null && c.you === null ? "text-silver-dim/80 italic" : "text-silver-dim")}>
            {out && <span className="font-semibold text-stamp not-italic sm:hidden">Out {eliminatedWhen(out).toLowerCase()} · </span>}
            {line}
          </span>
        </span>
        {/* A phone row has no room for the stamp beside the names: the score line says it instead. */}
        {out && <EliminatedStamp out={out} size="sm" className="max-sm:hidden" />}
        <svg
          viewBox="0 0 24 24"
          width={18}
          height={18}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0 text-silver-dim transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-gold-light"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </Link>
    </li>
  );
}

function RosterSkeleton({ mode }: { mode: RosterMode }) {
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">Loading the couples...</span>
      {mode === "cards" ? (
        <Skeleton className="mx-auto h-[30rem] w-[85%] max-w-md rounded-2xl" />
      ) : (
        [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)
      )}
    </div>
  );
}
