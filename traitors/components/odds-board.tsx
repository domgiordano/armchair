"use client";

import { useEffect, useId, useState } from "react";

import { Headshot } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { cn, EYEBROW, TEXT_LINK } from "@/lib/ui";
import {
  getOdds,
  moveLabel,
  percent,
  sourceLabel,
  trend,
  type OddsBoard as Board,
  type OddsEntry,
} from "@armchair/app-core/favorites/odds";

type Entry = OddsEntry<string | null>;
type Load = { kind: "loading" } | { kind: "ready"; board: Board<string | null> } | { kind: "error"; message: string };

interface OddsBoardProps {
  season: string;
  /** Rows shown before "Show all". */
  top?: number;
}

/**
 * Odds to win, as of the last episode you've made every call in. Nobody comes off
 * the board, and no odds move, for an episode you haven't opened.
 */
export function OddsBoard({ season, top = 5 }: OddsBoardProps) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  // The bet sheet opens over the overview, which has a board of its own.
  const heading = useId();

  useEffect(() => {
    let cancelled = false;
    getOdds<string | null>(season).then(
      (board) => !cancelled && setLoad({ kind: "ready", board }),
      (e: unknown) => !cancelled && setLoad({ kind: "error", message: e instanceof Error ? e.message : "Request failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [season, attempt]);

  return (
    <section aria-labelledby={heading} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id={heading} className={EYEBROW}>
          Odds to win
        </h2>
        {load.kind === "ready" && load.board.entries.length > 0 && (
          <p className="text-sm text-ash">{sourceLabel(load.board)}</p>
        )}
      </div>
      {load.kind === "loading" && <SkeletonList label="Loading the odds" rows={3} />}
      {load.kind === "error" && (
        <ErrorState
          what="the odds"
          message={load.message}
          retry={() => {
            setLoad({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
        />
      )}
      {load.kind === "ready" && <BoardView board={load.board} top={top} />}
    </section>
  );
}

function BoardView({ board, top }: { board: Board<string | null>; top: number }) {
  const [all, setAll] = useState(false);
  if (board.entries.length === 0) {
    return (
      <Card>
        <p className="text-ash">Odds open once our players have made their winner picks or the first round table is in.</p>
      </Card>
    );
  }
  const rows = all ? board.entries : board.entries.slice(0, top);
  return (
    <Card className="flex flex-col gap-3">
      {board.behind && board.asOf !== null && (
        <p className="border-l-2 border-candle pl-3 text-parchment">
          As of episode {board.asOf}. The odds update after you make your calls in episode {board.asOf + 1}, so nothing
          gives its result away.
        </p>
      )}
      <ol className="flex flex-col divide-y divide-gilt/15">
        {rows.map((e) => (
          <Row key={e.id} e={e} />
        ))}
      </ol>
      {board.entries.length > top && (
        <button type="button" onClick={() => setAll(!all)} className={cn(TEXT_LINK, "self-start")}>
          {all ? "Show fewer" : `Show all ${board.entries.length}`}
        </button>
      )}
      <p className="text-sm text-ash">
        {board.market ? (
          <>
            Market prices from{" "}
            <a href={board.market.url} target="_blank" rel="noreferrer" className={TEXT_LINK}>
              {board.market.source}
            </a>
            . Model: {board.model.toLowerCase()}.
          </>
        ) : (
          <>Model: {board.model.toLowerCase()}. No published odds we can use for this season.</>
        )}
      </p>
    </Card>
  );
}

function Row({ e }: { e: Entry }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="w-5 shrink-0 text-right font-display text-ash nums">{e.rank}</span>
      <Headshot name={e.name ?? e.id} image={e.headshot} size={40} round />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-bone">{e.name}</p>
        {e.why.length > 0 && (
          <ul aria-label="Why" className="flex flex-wrap gap-1">
            {e.why.map((w) => (
              <li key={w} className="rounded-sm border border-gilt/25 px-1.5 text-xs leading-5 whitespace-nowrap text-parchment">
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="flex items-center gap-1.5">
          <Move move={e.move} />
          <span className="font-display text-lg font-semibold text-candle nums">{e.odds ?? "-"}</span>
        </span>
        <span className="text-sm text-ash nums">{e.chance === null ? "" : percent(e.chance)}</span>
      </div>
    </li>
  );
}

function Move({ move }: { move: Entry["move"] }) {
  const t = trend(move);
  const label = moveLabel(move);
  if (!t || !label) return null;
  return (
    <span title={label} className={cn("inline-flex", t === "up" ? "text-moss" : t === "down" ? "text-blood-hi" : "text-ash")}>
      <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3" fill="currentColor">
        {t === "up" && <path d="M6 2 11 9H1z" />}
        {t === "down" && <path d="M6 10 1 3h10z" />}
        {t === "flat" && <rect x="2" y="5" width="8" height="2" rx="1" />}
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
