"use client";

import { useId, useState } from "react";

import { Headshot } from "@/components/headshot";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { Headshot as HeadshotData } from "@/lib/api/show";
import { useSealedEpisodes } from "@/lib/show/sealed";
import { useOdds } from "@/lib/show/use-odds";
import { cn, TEXT_LINK } from "@/lib/ui";
import {
  moveLabel,
  percent,
  sourceLabel,
  trend,
  type OddsBoard as Board,
  type OddsEntry,
} from "@armchair/app-core/favorites/odds";

const PANEL = "rounded-xl border border-silver/10 bg-ballroom/45 p-4 shadow-[inset_0_1px_0_rgb(213_219_234/0.05)] sm:p-5";
const SHOWN = 5;

type Entry = OddsEntry<HeadshotData | null>;

/** "Week 4", or "Week 1, night 2" when a week has two episodes. */
export function weekLabel(episodes: Board<unknown>["episodes"], ep: number): string {
  const all = episodes ?? [];
  const e = all.find((x) => x.ep === ep);
  if (!e || e.week === null) return `Episode ${ep}`;
  const nights = all.filter((x) => x.week === e.week);
  return nights.length < 2 ? `Week ${e.week}` : `Week ${e.week}, night ${nights.findIndex((x) => x.ep === ep) + 1}`;
}

/** Odds to win the season, as of the last episode you've finished: never a result you haven't seen. */
export function OddsBoard({ season }: { season: string }) {
  const sealed = useSealedEpisodes(season);
  const through = sealed.length ? sealed[0] - 1 : undefined;
  const load = useOdds(season, through);
  const heading = useId();

  return (
    <section aria-labelledby={heading} className={`${PANEL} flex min-w-0 flex-col gap-3`}>
      <div className="flex flex-col gap-0.5">
        <h2 id={heading} className="text-lg font-semibold text-pearl">
          Odds to win
        </h2>
        {load.kind === "ready" && load.board.entries.length > 0 && (
          <p className="text-xs text-silver-dim">{sourceLabel(load.board)}</p>
        )}
      </div>
      {load.kind === "loading" && (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Loading the odds...</span>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      )}
      {load.kind === "error" && <ErrorState what="the odds" message={load.message} retry={load.retry} />}
      {load.kind === "ready" && <BoardView board={load.board} />}
    </section>
  );
}

function BoardView({ board }: { board: Board<HeadshotData | null> }) {
  const [all, setAll] = useState(false);
  if (board.entries.length === 0) {
    return <EmptyState compact>Odds open once the first episode is scored and you&apos;ve finished it.</EmptyState>;
  }
  const rows = all ? board.entries : board.entries.slice(0, SHOWN);
  const next = board.asOf === null ? null : weekLabel(board.episodes, board.asOf + 1);

  return (
    <>
      {board.behind && board.asOf !== null && (
        <p className="rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-sm text-gold-light">
          As of {weekLabel(board.episodes, board.asOf)}. The odds update after you finish {next}, so nothing gives its
          result away.
        </p>
      )}
      <ol className="flex flex-col divide-y divide-silver/10">
        {rows.map((e) => (
          <Row key={e.id} e={e} market={board.market !== null} />
        ))}
      </ol>
      {board.entries.length > SHOWN && (
        <button type="button" onClick={() => setAll(!all)} className={`${TEXT_LINK} self-start`}>
          {all ? "Show fewer" : `Show all ${board.entries.length}`}
        </button>
      )}
      <p className="text-xs text-silver-dim">
        {board.market ? (
          <>
            Market prices from{" "}
            <a href={board.market.url} target="_blank" rel="noreferrer" className={TEXT_LINK}>
              {board.market.source}
            </a>
            , renormalized over the couples still in. Model: {board.model.toLowerCase()}.
          </>
        ) : (
          <>Model: {board.model.toLowerCase()}. No published odds for this season.</>
        )}
      </p>
    </>
  );
}

function Row({ e, market }: { e: Entry; market: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="w-5 shrink-0 text-right text-sm font-semibold text-silver-dim tabular-nums">{e.rank}</span>
      <Headshot person={{ name: e.name ?? e.id, headshot: e.headshot }} size={40} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-pearl">{e.name}</span>
          {e.partner && <span className="truncate text-xs text-silver-dim">with {e.partner}</span>}
        </p>
        {e.why.length > 0 && (
          <ul aria-label="Why" className="flex flex-wrap gap-1">
            {e.why.map((w) => (
              <li key={w} className="rounded-full border border-silver/15 px-2 py-px text-[11px] leading-4 whitespace-nowrap text-silver">
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="flex items-center gap-1.5">
          <Move move={e.move} />
          <span className="text-base font-semibold text-gold-light tabular-nums">{e.odds ?? "-"}</span>
        </span>
        <span className="text-xs text-silver-dim tabular-nums">
          {e.chance === null ? "" : percent(e.chance)}
          {market && e.model !== null && <span className="text-silver-dim/80"> · model {percent(e.model)}</span>}
        </span>
      </div>
    </li>
  );
}

function Move({ move }: { move: Entry["move"] }) {
  const t = trend(move);
  const label = moveLabel(move);
  if (!t || !label) return null;
  return (
    <span title={label} className={cn("inline-flex", t === "up" ? "text-emerald-300" : t === "down" ? "text-red-300" : "text-silver-dim")}>
      <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3" fill="currentColor">
        {t === "up" && <path d="M6 2 11 9H1z" />}
        {t === "down" && <path d="M6 10 1 3h10z" />}
        {t === "flat" && <rect x="2" y="5" width="8" height="2" rx="1" />}
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
