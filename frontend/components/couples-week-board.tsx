"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { CoupleNames, PersonLink } from "@/components/couple-names";
import { DiscoLoader } from "@/components/disco-loader";
import { CoupleAvatars } from "@/components/headshot";
import { judgeName } from "@/components/leaderboard-screen";
import { formatScore } from "@/components/performance-card";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { tabId, Tabs } from "@/components/ui/tabs";
import { getWeekBoard, type BoardColumn, type BoardRow, type WeekBoard } from "@/lib/api/couples";
import type { Season } from "@/lib/api/show";
import { baseline, boardOrder, movement, ordinal } from "@/lib/show/couples";
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
  const scoreHref = withSeason(`/episode/?ep=${board.ep}`, season.season);
  const rows = boardOrder(board.couples, column);
  const ranked = rows.filter((r) => r.ranks[column] !== null);
  const unranked = rows.filter((r) => r.ranks[column] === null);
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
            <Ranking rows={ranked} column={column} />
            {unranked.length > 0 && (
              <p className="px-1 text-xs text-silver-dim">
                {unranked.length} more without a {column === "judges" ? "confirmed panel" : "number"} yet
                {column === "friends" || column === "everyone" ? ": an average needs two people." : "."}
              </p>
            )}
          </section>

          <div className="flex flex-col gap-4 lg:sticky lg:top-32">
            {split.length > 0 && <Disagreements rows={split} />}
            {left > 0 && (
              <Card id="locked" title={`${left} still to score`} note="Score them to see where they land.">
                <ul className="flex flex-wrap gap-2">
                  {board.locked.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 rounded-full border border-silver/10 bg-ink/40 py-1 pr-3 pl-1 text-sm text-silver opacity-80">
                      <CoupleAvatars members={c.members} size={24} />
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
function Ranking({ rows, column }: { rows: BoardRow[]; column: BoardColumn }) {
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
  }, [column, reduced]);

  return (
    <ol ref={list} aria-label="Couples" className="relative flex flex-col gap-1.5">
      {rows.map((r) => (
        <BoardItem key={r.id} row={r} column={column} />
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

function BoardItem({ row: r, column }: { row: BoardRow; column: BoardColumn }) {
  const rank = r.ranks[column];
  const move = movement(r, column);
  const value = VALUE[column](r);
  const versus = baseline(column);
  return (
    <li
      data-id={r.id}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        rank === 1 ? "border-gold/40 bg-gradient-to-r from-gold/10 to-ballroom/40" : "border-silver/10 bg-ballroom/45",
      )}
    >
      <span className={cn("w-6 shrink-0 text-right font-display text-xl tabular-nums", rank === 1 ? "text-gold" : "text-silver-dim")}>{rank}</span>
      <Movement by={move} versus={versus} />
      <CoupleAvatars members={r.members} size={36} />
      <span className="flex min-w-0 flex-1 flex-col">
        <CoupleNames members={r.members} className="truncate text-sm font-medium text-pearl" />
        <span className="truncate text-xs text-silver-dim tabular-nums">
          {[
            column !== "judges" && r.judges !== null && `Judges ${formatScore(r.judges)}`,
            column !== "you" && r.you !== null && `You ${formatScore(r.you)}`,
            r.styles.filter(Boolean).join(", "),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span className="flex flex-col items-end">
        <span className="text-lg font-semibold text-pearl tabular-nums">{value === null ? "–" : formatScore(value)}</span>
        {column === "judges" && r.judgesTotal !== null && r.dances > 1 && (
          <span className="text-[11px] text-silver-dim tabular-nums">{formatScore(r.judgesTotal)} total</span>
        )}
      </span>
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

function Disagreements({ rows }: { rows: BoardRow[] }) {
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
              <CoupleAvatars members={r.members} size={32} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-pearl">{name(r)}</span>
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
