"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { CoupleLink, CoupleNames, PersonLink } from "@/components/couple-names";
import { DiscoLoader } from "@/components/disco-loader";
import { EliminatedStamp, OUT_FADE, OUT_STRIKE, ShowEliminated } from "@/components/eliminated";
import { judgeName } from "@/components/leaderboard-screen";
import { formatScore } from "@/components/performance-card";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { tabId, Tabs } from "@/components/ui/tabs";
import { getWeekBoard, type BoardColumn, type BoardRow, type Elimination, type WeekBoard } from "@/lib/api/couples";
import type { Season } from "@/lib/api/show";
import { baseline, boardOrder, movement, ordinal } from "@/lib/show/couples";
import { useShowEliminated } from "@/lib/show/eliminated";
import { coupleHref } from "@/lib/show/people";
import { episodeLabel, hasAired, latestAired } from "@/lib/show/schedule";
import { withSeason } from "@/lib/show/seasons";
import { useReducedMotion } from "@/lib/motion";
import { button, cn, EYEBROW } from "@/lib/ui";

type Load = { kind: "loading" } | { kind: "ready"; board: WeekBoard } | { kind: "error"; message: string };

const PANEL = "week-board-panel";
const name = (r: { members: BoardRow["members"] }) => r.members.find((m) => m.role === "celebrity")?.name ?? r.members[0]?.name ?? "";

export function WeekBoardView({ season, group }: { season: Season; group: string | null }) {
  // Read once: the board shouldn't jump to a new episode while someone is reading it.
  const [aired] = useState(() => season.episodes.filter((e) => hasAired(e, season.timezone, Date.now())));
  const [ep, setEp] = useState(() => latestAired(season.episodes, season.timezone, Date.now()).ep);
  const [column, setColumn] = useState<BoardColumn>("judges");
  const options = (aired.length ? aired : season.episodes).map((e) => ({
    value: String(e.ep),
    label: episodeLabel(e, season.episodes),
    detail: e.theme ?? undefined,
  }));

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <Select label="Episode" className="md:w-64" value={String(ep)} options={options} onChange={(v) => setEp(Number(v))} />
        <div className="md:flex-1 md:max-w-lg">
          <Tabs
            label="Rank by"
            tabs={[
              { id: "judges", label: "Judges" },
              { id: "you", label: "You" },
              { id: "friends", label: "Friends" },
              { id: "everyone", label: group ? "Group" : "Everyone" },
            ]}
            value={column}
            onChange={setColumn}
            panelId={PANEL}
          />
        </div>
      </div>
      <div id={PANEL} role="tabpanel" aria-labelledby={tabId(PANEL, column)} className="flex flex-col gap-4">
        <BoardFetcher key={`${season.season}|${ep}|${group}`} season={season} ep={ep} group={group} column={column} />
      </div>
    </>
  );
}

function BoardFetcher({ season, ep, group, column }: { season: Season; ep: number; group: string | null; column: BoardColumn }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getWeekBoard(season.season, ep, group).then(
      (board) => !cancelled && setLoad({ kind: "ready", board }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: e instanceof Error ? e.message : "Request failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [season.season, ep, group, attempt]);

  if (load.kind === "loading") return <BoardSkeleton />;
  if (load.kind === "error") {
    const retry = () => {
      setLoad({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return <ErrorState what="the week's board" message={load.message} retry={retry} />;
  }
  return <Board board={load.board} season={season} column={column} />;
}

const VERB: Record<BoardColumn, string> = { judges: "the judges", you: "you", friends: "your friends", everyone: "everyone" };

function Board({ board, season, column }: { board: WeekBoard; season: Season; column: BoardColumn }) {
  const [showOut, setShowOut] = useShowEliminated("week-board");
  const scoreHref = withSeason(`/episode/?ep=${board.ep}`, season.season);
  const gone = new Set(board.eliminated);
  const out: Elimination = { ep: board.ep, week: board.week };
  const rows = boardOrder(board.couples, column);
  const dancing = rows.filter((r) => !gone.has(r.id));
  const ranked = dancing.filter((r) => r.ranks[column] !== null);
  const unranked = dancing.filter((r) => r.ranks[column] === null);
  // Gone home that night: listed after everyone still dancing, whatever their rank.
  const eliminated = showOut ? rows.filter((r) => gone.has(r.id)) : [];
  const byId = new Map(board.couples.map((r) => [r.id, r]));
  const split = board.disagreements.flatMap((id) => byId.get(id) ?? []);
  const left = board.open ? 0 : board.rateable - board.answered;

  return (
    <>
      {board.panel.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-silver-dim">
          <span className={EYEBROW}>Panel</span>
          {board.panel.map((j, i) => (
            <span key={j}>
              <PersonLink id={j} name={judgeName(j, season.judges)} className="text-silver" />
              {season.judges.find((x) => x.id === j)?.guest && <span className="text-silver-dim"> (guest)</span>}
              {i < board.panel.length - 1 && <span aria-hidden="true"> ·</span>}
            </span>
          ))}
        </p>
      )}

      {board.couples.length === 0 && board.open ? (
        <EmptyState title="No dances on record">This episode has no scored dances to rank.</EmptyState>
      ) : board.couples.length === 0 ? (
        <EmptyState
          title="Score this episode to see its board"
          action={
            <Link href={scoreHref} className={button("primary", "sm")}>
              Score {board.rateable} {board.rateable === 1 ? "dance" : "dances"}
            </Link>
          }
        >
          Couples join the ranking as you score them, so nothing here gives a result away.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
          <section aria-label={`Ranked by ${VERB[column]}`} className="flex flex-col gap-2">
            <ShowEliminated checked={showOut} onChange={setShowOut} count={gone.size} />
            <Ranking rows={ranked} eliminated={eliminated} out={out} season={season.season} column={column} />
            {unranked.length > 0 && (
              <p className="px-1 text-xs text-silver-dim">
                {unranked.length} more without a {column === "judges" ? "confirmed panel" : "number"} yet
                {column === "friends" || column === "everyone" ? ": an average needs two people." : "."}
              </p>
            )}
          </section>

          <div className="flex flex-col gap-4 lg:sticky lg:top-32">
            {split.length > 0 && <Disagreements rows={split} season={season.season} />}
            {left > 0 && (
              <Card id="locked" title={`${left} still to score`} note="Score them to see where they land.">
                <ul className="flex flex-wrap gap-2">
                  {board.locked.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 rounded-full border border-silver/10 bg-ink/40 py-1 pr-3 pl-1 text-sm text-silver opacity-80">
                      <CoupleLink members={c.members} season={season.season} size={24} />
                      {name(c)}
                    </li>
                  ))}
                </ul>
                <Link href={scoreHref} className={cn(button("secondary", "sm"), "self-start")}>
                  Score them
                </Link>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The ranking, re-sorted in place: each row slides from where it was to where
 * the new column puts it (FLIP), so a toggle shows who moved.
 */
interface RankingProps {
  rows: BoardRow[];
  /** Listed after `rows`, stamped. */
  eliminated: BoardRow[];
  out: Elimination;
  season: string;
  column: BoardColumn;
}

function Ranking({ rows, eliminated, out, season, column }: RankingProps) {
  const list = useRef<HTMLOListElement>(null);
  const tops = useRef(new Map<string, number>());
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const items = [...(list.current?.children ?? [])] as HTMLElement[];
    for (const item of items) {
      const before = tops.current.get(item.dataset.id ?? "");
      const dy = before === undefined ? 0 : before - item.offsetTop;
      if (dy && !reduced && typeof item.animate === "function") {
        item.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
          duration: 520,
          easing: "cubic-bezier(0.2, 0.8, 0.3, 1)",
        });
      }
    }
    tops.current = new Map(items.map((i) => [i.dataset.id ?? "", i.offsetTop]));
  }, [column, reduced, eliminated.length]);

  return (
    <ol ref={list} aria-label="Couples" className="relative flex flex-col gap-1.5">
      {rows.map((r) => (
        <BoardItem key={r.id} row={r} season={season} column={column} />
      ))}
      {eliminated.map((r) => (
        <BoardItem key={r.id} row={r} season={season} column={column} out={out} />
      ))}
    </ol>
  );
}

const VALUE: Record<BoardColumn, (r: BoardRow) => number | null> = {
  judges: (r) => r.judges,
  you: (r) => r.you,
  friends: (r) => r.friends,
  everyone: (r) => r.everyone,
};

interface BoardItemProps {
  row: BoardRow;
  season: string;
  column: BoardColumn;
  /** Set when the couple went home this episode. */
  out?: Elimination;
}

/** One couple's row. Tapping it opens their every dance of the season. */
function BoardItem({ row: r, season, column, out }: BoardItemProps) {
  const router = useRouter();
  const rank = r.ranks[column];
  const move = movement(r, column);
  const value = VALUE[column](r);
  const versus = baseline(column);
  const top = rank === 1 && !out;
  return (
    <li
      data-id={r.id}
      onClick={() => router.push(coupleHref(r.members, season))}
      className={cn(
        "relative flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        out
          ? "border-dashed border-silver/15 bg-ink/40 hover:border-silver/30"
          : top
            ? "border-gold/40 bg-gradient-to-r from-gold/10 to-ballroom/40 hover:border-gold/60"
            : "border-silver/10 bg-ballroom/45 hover:border-silver/25 hover:bg-ballroom/70",
      )}
    >
      <span className={cn("w-6 shrink-0 text-right font-display text-xl tabular-nums", top ? "text-gold" : "text-silver-dim", out && "opacity-55")}>
        {rank}
      </span>
      {out ? <span aria-hidden="true" className="w-8 shrink-0" /> : <Movement by={move} versus={versus} />}
      <span className={cn("shrink-0", out && OUT_FADE)}>
        <CoupleLink members={r.members} season={season} size={36} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <CoupleNames members={r.members} className={cn("truncate text-sm font-medium", out ? cn("text-silver-dim", OUT_STRIKE) : "text-pearl")} />
        <span className={cn("truncate text-xs text-silver-dim tabular-nums", out && "opacity-70")}>
          {[
            column !== "judges" && r.judges !== null && `Judges ${formatScore(r.judges)}`,
            column !== "you" && r.you !== null && `You ${formatScore(r.you)}`,
            r.styles.filter(Boolean).join(", "),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span className={cn("flex flex-col items-end", out && "opacity-55")}>
        <span className="text-lg font-semibold text-pearl tabular-nums">{value === null ? "–" : formatScore(value)}</span>
        {column === "judges" && r.judgesTotal !== null && r.dances > 1 && (
          <span className="text-[11px] text-silver-dim tabular-nums">{formatScore(r.judgesTotal)} total</span>
        )}
      </span>
      {out && <EliminatedStamp out={out} size="sm" className="absolute top-1/2 left-3 -translate-y-1/2 sm:left-8" />}
    </li>
  );
}

function Movement({ by, versus }: { by: number | null; versus: BoardColumn }) {
  if (by === null || by === 0) {
    return (
      <span className="flex w-8 shrink-0 justify-center text-xs text-silver-dim/60" aria-hidden="true">
        –
      </span>
    );
  }
  const up = by > 0;
  return (
    <span
      className={cn("flex w-8 shrink-0 items-center justify-center gap-0.5 text-xs font-semibold tabular-nums animate-fade-in", up ? "text-emerald-300" : "text-rose-300")}
      title={`${Math.abs(by)} ${Math.abs(by) === 1 ? "place" : "places"} ${up ? "higher" : "lower"} than ${VERB[versus]}`}
    >
      <svg viewBox="0 0 10 10" width={9} height={9} aria-hidden="true" className={up ? "" : "rotate-180"}>
        <path d="M5 1 9 8H1Z" fill="currentColor" />
      </svg>
      {Math.abs(by)}
      <span className="sr-only">{` ${up ? "higher" : "lower"} than ${VERB[versus]}`}</span>
    </span>
  );
}

function Disagreements({ rows, season }: { rows: BoardRow[]; season: string }) {
  return (
    <section
      aria-labelledby="disagreements"
      className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-brand-magenta/30 bg-gradient-to-br from-brand-magenta/10 via-ballroom/60 to-ink p-4"
    >
      <span aria-hidden="true" className="absolute -top-14 -right-10 size-40 rounded-full bg-[radial-gradient(circle,rgb(232_63_208/0.18),transparent_70%)]" />
      <div className="flex flex-col">
        <h2 id="disagreements" className="text-xs font-semibold tracking-[0.16em] text-gold uppercase">
          Biggest disagreements
        </h2>
        <p className="text-xs text-silver-dim">Where your ranking and the judges&apos; split furthest.</p>
      </div>
      <ol className="stagger flex flex-col gap-2.5">
        {rows.map((r) => {
          const you = r.ranks.you ?? 0;
          const judges = r.ranks.judges ?? 0;
          return (
            <li key={r.id} className="flex items-center gap-3">
              <CoupleLink members={r.members} season={season} size={32} />
              <span className="flex min-w-0 flex-1 flex-col">
                <CoupleNames members={r.members} className="truncate text-sm font-medium text-pearl" />
                <span className="text-xs text-silver-dim tabular-nums">
                  You {r.you === null ? "–" : formatScore(r.you)} · judges {r.judges === null ? "–" : formatScore(r.judges)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end text-xs tabular-nums">
                <span className="font-semibold text-gold-light">You {ordinal(you)}</span>
                <span className="text-silver-dim">Judges {ordinal(judges)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div role="status" className="flex flex-col gap-1.5">
        <span className="sr-only">Loading the week&apos;s board...</span>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
      <div className="hidden flex-col items-center justify-center gap-3 rounded-xl border border-silver/10 bg-ballroom/30 py-10 lg:flex">
        <DiscoLoader size="md" label="Tallying the panel" />
      </div>
    </div>
  );
}
