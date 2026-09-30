"use client";

import { useEffect, useState, type ReactNode } from "react";

import { getEpisodeState, type Episode } from "@/lib/api/show";
import { episodeLabel, hasAired } from "@/lib/show/schedule";
import { PRIMARY, SECONDARY } from "@/lib/ui";

interface CatchUpProps {
  season: string;
  tz: string;
  episodes: Episode[];
  episode: Episode;
  now: number;
  onFinishPrevious: (previous: Episode) => void;
  children: ReactNode;
}

type Check = { kind: "checking" } | { kind: "clear" } | { kind: "behind"; open: number };

/**
 * Asks before showing episode N while N-1 has unanswered performances: N's
 * roster gives away who went home in N-1. Going ahead leaves N-1 scorable.
 */
export function CatchUp({ season, tz, episodes, episode, now, onFinishPrevious, children }: CatchUpProps) {
  const previous = episodes[episodes.indexOf(episode) - 1];
  const needed = previous !== undefined && hasAired(previous, tz, now);
  const [check, setCheck] = useState<Check>({ kind: "checking" });

  useEffect(() => {
    if (!needed) return;
    let cancelled = false;
    getEpisodeState(season, previous.ep).then(
      (s) => !cancelled && setCheck(s.answered < s.rateable ? { kind: "behind", open: s.rateable - s.answered } : { kind: "clear" }),
      // The plan accepts the elimination leak, so a failed check shows the episode.
      () => !cancelled && setCheck({ kind: "clear" }),
    );
    return () => {
      cancelled = true;
    };
  }, [needed, season, previous]);

  if (!needed || check.kind === "clear") return children;
  if (check.kind === "checking") return <p className="text-neutral-400">Loading the episode...</p>;

  const prevLabel = episodeLabel(previous, episodes).toLowerCase();
  const label = episodeLabel(episode, episodes).toLowerCase();
  return (
    <section aria-labelledby="catch-up-title" className="flex flex-col gap-3 rounded-lg border border-neutral-700 p-4">
      <h1 id="catch-up-title" className="text-xl font-semibold tracking-tight">
        Finish {prevLabel} first?
      </h1>
      <p className="text-neutral-300">
        You have {check.open} {check.open === 1 ? "dance" : "dances"} left to score in {prevLabel}. Opening {label}{" "}
        shows who is still dancing, which gives away the result.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onFinishPrevious(previous)} className={PRIMARY}>
          Finish {prevLabel}
        </button>
        <button type="button" onClick={() => setCheck({ kind: "clear" })} className={SECONDARY}>
          Go to {label}
        </button>
      </div>
    </section>
  );
}
