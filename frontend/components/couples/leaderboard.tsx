"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { BoardHighlights } from "@/components/couples/board-highlights";
import { CompareBar, MAX_COMPARE } from "@/components/couples/compare";
import { Sparkline } from "@/components/couples/sparkline";
import { EliminatedStamp, OUT_FADE, OUT_STRIKE, ShowEliminated } from "@/components/eliminated";
import { CoupleAvatars } from "@/components/headshot";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { Season } from "@/lib/api/show";
import { signed } from "@/lib/show/couples";
import {
  board,
  BOARD_SORTS,
  celebrityName,
  highlights,
  loadBoard,
  sortValue,
  type BoardCouple,
  type BoardData,
  type BoardSort,
} from "@/lib/show/couples-board";
import { eliminatedWhen, useShowEliminated } from "@/lib/show/eliminated";
import { coupleHref } from "@/lib/show/people";
import { withSeason } from "@/lib/show/seasons";
import { useMediaQuery } from "@/lib/motion";
import { button, cn, FOCUS, TEXT_LINK } from "@/lib/ui";

type Load = { kind: "loading" } | { kind: "ready"; data: BoardData } | { kind: "error"; message: string };

export function LeaderboardView({ season }: { season: Season }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadBoard(season).then(
      (data) => !cancelled && setLoad({ kind: "ready", data }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: e instanceof Error ? e.message : "Request failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [season, attempt]);

  if (load.kind === "loading") return <LeaderboardSkeleton />;
  if (load.kind === "error") {
    const retry = () => {
      setLoad({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return <ErrorState what="the leaderboard" message={load.message} retry={retry} />;
  }
  const { data } = load;
  if (data.through === null) {
    const scoreHref = data.next && withSeason(`/episode/?ep=${data.next.ep}`, season.season);
    return (
      <EmptyState
        title={data.next ? "Finish week 1 to open the board" : "No dances yet"}
        action={
          scoreHref && (
            <Link href={scoreHref} className={button("primary", "sm")}>
              {data.next?.sealed ? "Reveal week 1" : "Score week 1"}
            </Link>
          )
        }
      >
        {data.next
          ? "The leaderboard runs as far as you've watched, so nothing here gives a result away."
          : "The board fills in once the first week's dances are scored."}
      </EmptyState>
    );
  }
  return <Leaderboard season={season} data={data} through={data.through} />;
}

const CAPTION: Record<BoardSort, string> = {
  average: "avg",
  last: "this week",
  best: "best",
  crowd: "crowd",
  delta: "vs judges",
  trend: "trend",
  dances: "dances",
  perfect: "perfect",
};

const SIGNED_SORTS: BoardSort[] = ["delta", "trend"];

const COUNT_SORTS: BoardSort[] = ["dances", "perfect"];

// Scores to one place so a column of them lines up; counts as they are.
const show = (n: number | null) => (n === null ? "–" : n.toFixed(1));
const shown = (by: BoardSort, n: number | null) =>
  n === null ? "–" : SIGNED_SORTS.includes(by) ? signed(n) : COUNT_SORTS.includes(by) ? String(n) : show(n);

function Leaderboard({ season, data, through }: { season: Season; data: BoardData; through: number }) {
  const [week, setWeek] = useState(through);
  const [sort, setSort] = useState<BoardSort>("average");
  const [showOut, setShowOut] = useShowEliminated("couples");
  const [picked, setPicked] = useState<string[]>([]);
  const wide = useMediaQuery("(min-width: 1024px)");
  const base = { roster: season.contestants, dances: data.dances, outs: data.outs, week };
  const rows = board({ ...base, by: sort, showOut });
  // Every sparkline on one scale, from just under the board's lowest week to a perfect 10.
  const floor = Math.max(1, Math.floor(Math.min(10, ...rows.flatMap((c) => c.weeks.map((w) => w.score)))) - 1);
  const gone = [...data.outs.values()].filter((o) => (o.week ?? o.ep) <= week).length;
  const label = BOARD_SORTS.find((s) => s.value === sort)?.label ?? "";
  // Picked couples stay picked while hidden by the switch, and show at the board's week.
  const everyone = board({ ...base, by: sort, showOut: true });
  const compare = picked.flatMap((id) => everyone.filter((c) => c.id === id));
  const pick: Picking = {
    picked,
    toggle: (id) => setPicked((now) => (now.includes(id) ? now.filter((x) => x !== id) : now.length < MAX_COMPARE ? [...now, id] : now)),
  };
  const weekOptions = [...data.weeks].reverse().map((w) => ({
    value: String(w.week),
    label: `Week ${w.week}`,
    detail: w.theme ?? undefined,
  }));

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <Select label="Board as of" className="sm:w-56" value={String(week)} options={weekOptions} onChange={(v) => setWeek(Number(v))} />
          {!wide && <Select label="Rank by" className="sm:w-56" value={sort} options={BOARD_SORTS} onChange={(v) => setSort(v as BoardSort)} />}
        </div>
        <ShowEliminated checked={showOut} onChange={setShowOut} count={gone} />
      </div>

      {data.next && <BehindNote next={data.next} season={season.season} />}

      <BoardHighlights highlights={highlights(base)} week={week} season={season.season} roster={season.contestants} />

      {rows.length === 0 ? (
        <EmptyState compact title="Everyone has gone home">
          Switch on Show eliminated to see them.
        </EmptyState>
      ) : wide ? (
        <BoardTable rows={rows} week={week} floor={floor} sort={sort} onSort={setSort} label={label} season={season.season} pick={pick} />
      ) : (
        <BoardList rows={rows} week={week} floor={floor} sort={sort} label={label} season={season.season} pick={pick} />
      )}
      <CompareBar picked={compare} week={week} season={season.season} onClear={() => setPicked([])} />
    </>
  );
}

function BehindNote({ next, season }: { next: NonNullable<BoardData["next"]>; season: string }) {
  return (
    <p role="status" className="rounded-xl border border-gold/20 bg-gold/5 px-3 py-2 text-sm text-silver">
      {next.sealed ? `Reveal your locked-in week ${next.week} dances` : `Finish week ${next.week}`} to move the board on.{" "}
      <Link href={withSeason(`/episode/?ep=${next.ep}`, season)} className={TEXT_LINK}>
        {next.sealed ? "Reveal them" : "Score it"}
      </Link>
    </p>
  );
}

interface BoardProps {
  rows: BoardCouple[];
  week: number;
  /** The sparklines' lowest score. */
  floor: number;
  sort: BoardSort;
  /** The sort's name, for the list's label. */
  label: string;
  season: string;
  pick: Picking;
}

interface Picking {
  picked: string[];
  toggle: (id: string) => void;
}

/** A row's Compare box: 44px to tap, and closed to more once three are picked. */
function Pick({ couple: c, pick }: { couple: BoardCouple; pick: Picking }) {
  const on = pick.picked.includes(c.id);
  const full = !on && pick.picked.length >= MAX_COMPARE;
  return (
    <label onClick={(e) => e.stopPropagation()} className={cn("-m-1.5 flex size-11 shrink-0 items-center justify-center", full ? "cursor-not-allowed" : "cursor-pointer")}>
      <input
        type="checkbox"
        checked={on}
        disabled={full}
        onChange={() => pick.toggle(c.id)}
        aria-label={`Compare ${celebrityName(c.members)}`}
        className="size-5 cursor-[inherit] rounded accent-gold disabled:opacity-35 focus-ring"
      />
    </label>
  );
}

// Fixed widths: the couple column takes what is left, so a long name truncates instead of widening the table.
const COLUMNS: { by: BoardSort; label: string; className: string }[] = [
  { by: "average", label: "Avg", className: "w-14 text-right" },
  { by: "last", label: "This week", className: "w-36 text-left" },
  { by: "best", label: "Best", className: "w-16 text-right" },
  { by: "crowd", label: "Crowd", className: "w-16 text-right" },
  { by: "delta", label: "Crowd vs judges", className: "w-20 text-right" },
  { by: "trend", label: "Trend", className: "w-28 text-left" },
  { by: "dances", label: "Dances", className: "w-18 text-right" },
  { by: "perfect", label: "Perfect", className: "w-18 text-right" },
];

function BoardTable({ rows, week, floor, sort, onSort, label, season, pick }: BoardProps & { onSort: (by: BoardSort) => void }) {
  const router = useRouter();
  return (
    <div className="rounded-xl border border-silver/10 bg-ballroom/30">
      <table className="w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">{`Couples ranked by ${label.toLowerCase()}, as of week ${week}`}</caption>
        <thead>
          <tr className="border-b border-silver/10 text-xs text-silver-dim">
            <th scope="col" className="w-12 py-2 pl-3">
              <span className="sr-only">Compare</span>
            </th>
            <th scope="col" className="w-14 py-2 pr-2 text-center font-medium">
              Rank
            </th>
            <th scope="col" className="py-2 text-left font-medium">
              Couple
            </th>
            {COLUMNS.map((c) => (
              <th key={c.by} scope="col" aria-sort={sort === c.by ? "descending" : undefined} className={cn("px-1 py-1 font-medium", c.className)}>
                <button
                  type="button"
                  onClick={() => onSort(c.by)}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-xs leading-tight transition-colors",
                    sort === c.by ? "text-gold-light" : "hover:text-pearl",
                    FOCUS,
                  )}
                >
                  {c.label}
                  <svg viewBox="0 0 10 10" width={8} height={8} aria-hidden="true" className={cn("shrink-0", sort === c.by ? "opacity-100" : "opacity-0")}>
                    <path d="M1 3h8L5 8Z" fill="currentColor" />
                  </svg>
                </button>
              </th>
            ))}
            <th scope="col" className="w-32 py-2 pr-4 text-left font-medium">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="stagger">
          {rows.map((c) => {
            const out = c.eliminated;
            return (
              <tr
                key={c.id}
                onClick={() => router.push(coupleHref(c.members, season))}
                className={cn(
                  "cursor-pointer border-b border-silver/5 transition-colors last:border-0 hover:bg-ballroom/70",
                  c.rank === 1 && "bg-gradient-to-r from-gold/10 to-transparent",
                )}
              >
                <td className="py-2.5 pl-3">
                  <Pick couple={c} pick={pick} />
                </td>
                <td className="py-2.5">
                  <Rank couple={c} week={week} />
                </td>
                <td className="py-2.5 pr-2">
                  <CoupleCell couple={c} season={season} size={40} />
                </td>
                <Num value={c.average} strong={sort === "average"} out={!!out} />
                <td className={cn("px-2 py-2.5", out && "opacity-55")}>
                  <ThisWeek couple={c} />
                </td>
                <Num value={c.best} strong={sort === "best"} out={!!out} />
                <Num value={c.crowd} strong={sort === "crowd"} out={!!out} />
                <td className={cn("px-2 py-2.5 text-right tabular-nums", out && "opacity-55")}>
                  <Delta value={c.delta} strong={sort === "delta"} gap />
                </td>
                <td className={cn("px-2 py-2.5", out && "opacity-55")}>
                  <span className="flex items-center gap-2">
                    <Sparkline weeks={c.weeks} through={week} floor={floor} className="shrink-0 text-silver-dim" />
                    <Delta value={c.trend} strong={sort === "trend"} />
                  </span>
                </td>
                <Num value={c.dances || null} count strong={sort === "dances"} out={!!out} />
                <Num value={c.dances ? c.perfect : null} count strong={sort === "perfect"} out={!!out} />
                <td className="py-2.5 pr-4">
                  {out ? <EliminatedStamp out={out} size="sm" /> : <Dancing />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Num({ value, count, strong, out }: { value: number | null; count?: boolean; strong: boolean; out: boolean }) {
  return (
    <td className={cn("px-2 py-2.5 text-right tabular-nums", strong ? "text-base font-semibold text-pearl" : "text-silver", out && "opacity-55")}>
      {count && value !== null ? value : show(value)}
    </td>
  );
}

function BoardList({ rows, week, floor, sort, label, season, pick }: BoardProps) {
  const router = useRouter();
  return (
    <ol aria-label={`Couples ranked by ${label.toLowerCase()}, as of week ${week}`} className="stagger flex flex-col gap-1.5">
      {rows.map((c) => {
        const out = c.eliminated;
        return (
          <li
            key={c.id}
            onClick={() => router.push(coupleHref(c.members, season))}
            className={cn(
              "grid cursor-pointer grid-cols-[2.5rem_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1.5 rounded-xl border px-2.5 py-2 transition-colors",
              out
                ? "border-dashed border-silver/15 bg-ink/40"
                : c.rank === 1
                  ? "border-gold/40 bg-gradient-to-r from-gold/10 to-ballroom/40"
                  : "border-silver/10 bg-ballroom/45 active:bg-ballroom/70",
            )}
          >
            <Rank couple={c} week={week} />
            <CoupleCell couple={c} season={season} size={36} />
            <span className={cn("flex flex-col items-end", out && "opacity-55")}>
              <span className="text-lg leading-tight font-semibold text-pearl tabular-nums">{shown(sort, sortValue(c, sort))}</span>
              <span className="text-[11px] text-silver-dim">{CAPTION[sort]}</span>
            </span>
            <Pick couple={c} pick={pick} />
            <dl className={cn("col-span-4 grid grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-x-2 border-t border-silver/5 pt-1.5", out && "opacity-55")}>
              {sort === "average" ? <Fact label="Trend" value={<Delta value={c.trend} strong={false} />} /> : <Fact label="Avg" value={show(c.average)} />}
              <Fact label={`Week ${week}`} value={show(c.last)} detail={c.lastStyles.join(", ") || undefined} />
              <Fact label="Best" value={show(c.best)} />
              <Fact
                label="Crowd"
                value={
                  <>
                    {show(c.crowd)}
                    {c.delta !== null && (
                      <span className="text-[11px] font-normal">
                        {" "}
                        <Delta value={c.delta} strong={false} gap />
                        <span className="sr-only"> against the judges</span>
                      </span>
                    )}
                  </>
                }
              />
              <div className="flex items-center">
                <dt className="sr-only">Weekly</dt>
                <dd>
                  <Sparkline weeks={c.weeks} through={week} floor={floor} className="text-silver-dim" />
                </dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ol>
  );
}

function Fact({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="truncate text-[10px] tracking-[0.08em] text-silver-dim uppercase">{label}</dt>
      <dd className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-pearl tabular-nums">{value}</span>
        {detail && <span className="truncate text-[10px] text-silver-dim">{detail}</span>}
      </dd>
    </div>
  );
}

function Rank({ couple: c, week }: { couple: BoardCouple; week: number }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className={cn("font-display text-xl leading-none tabular-nums", c.rank !== null && c.rank <= 3 ? "text-gold" : "text-silver-dim")}>
        {c.rank ?? "–"}
      </span>
      <Movement by={c.move} since={week - 1} />
    </span>
  );
}

function Movement({ by, since }: { by: number | null; since: number }) {
  if (by === null) return null;
  if (by === 0) {
    return (
      <span className="text-[11px] leading-none text-silver-dim/70">
        <span aria-hidden="true">=</span>
        <span className="sr-only">{`same place as week ${since}`}</span>
      </span>
    );
  }
  const up = by > 0;
  const places = Math.abs(by);
  return (
    <span className={cn("flex items-center gap-0.5 text-[11px] leading-none font-semibold tabular-nums", up ? "text-emerald-300" : "text-rose-300")}>
      <svg viewBox="0 0 10 10" width={8} height={8} aria-hidden="true" className={up ? "" : "rotate-180"}>
        <path d="M5 1 9 8H1Z" fill="currentColor" />
      </svg>
      {places}
      <span className="sr-only">{` ${places === 1 ? "place" : "places"} ${up ? "up" : "down"} since week ${since}`}</span>
    </span>
  );
}

function CoupleCell({ couple: c, season, size }: { couple: BoardCouple; season: string; size: number }) {
  const out = c.eliminated;
  const star = c.members.find((m) => m.role === "celebrity") ?? c.members[0];
  const pros = c.members.filter((m) => m !== star);
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className={cn("shrink-0", out && OUT_FADE)}>
        <CoupleAvatars members={c.members} size={size} />
      </span>
      <span className="flex min-w-0 flex-col">
        <Link
          href={coupleHref(c.members, season)}
          prefetch={false}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "truncate rounded-sm font-medium underline-offset-4 decoration-gold/50 hover:text-gold-light hover:underline",
            out ? cn("text-silver-dim", OUT_STRIKE) : "text-pearl",
            FOCUS,
          )}
        >
          {star?.name}
          <span className="sr-only">{pros.map((p) => ` & ${p.name}`).join("")}</span>
        </Link>
        <span aria-hidden="true" className="truncate text-xs text-silver-dim">
          {pros.map((p) => `& ${p.name}`).join(" ")}
        </span>
        {out && <span className="text-[11px] font-semibold text-stamp lg:hidden">{`Out ${eliminatedWhen(out).toLowerCase()}`}</span>}
      </span>
    </span>
  );
}

function ThisWeek({ couple: c }: { couple: BoardCouple }) {
  if (c.last === null) return <span className="text-silver-dim">–</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="font-medium text-pearl tabular-nums">{show(c.last)}</span>
      <span className="flex min-w-0 flex-wrap gap-1">
        {c.lastStyles.map((s, i) => (
          <StyleChip key={i}>{s}</StyleChip>
        ))}
      </span>
    </span>
  );
}

function StyleChip({ children }: { children: ReactNode }) {
  return <span className="truncate rounded-full border border-silver/15 bg-ink/40 px-2 py-px text-[11px] text-silver">{children}</span>;
}

/** A trend reads up green and down red; the crowd's gap to the judges reads gold over, blue under, as the other gaps do. */
function Delta({ value, strong, gap }: { value: number | null; strong: boolean; gap?: boolean }) {
  if (value === null) return <span className="text-silver-dim">–</span>;
  const level = Math.abs(value) < 0.05;
  const tone = level ? "text-silver" : value > 0 ? (gap ? "text-gold-light" : "text-emerald-300") : gap ? "text-sky-200" : "text-rose-300";
  return <span className={cn("tabular-nums", tone, strong && "font-semibold")}>{signed(value)}</span>;
}

function Dancing() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-silver">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-300" />
      Dancing
    </span>
  );
}

function LeaderboardSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">Loading the leaderboard...</span>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}
