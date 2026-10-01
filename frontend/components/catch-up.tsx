"use client";

import { useEffect, useState, type ReactNode } from "react";

import { SkipConfirm } from "@/components/skip-confirm";
import { getOverview, type OverviewEpisode } from "@/lib/api/overview";
import { skipBefore, type Episode } from "@/lib/api/show";
import { skipTarget, unfinishedBefore } from "@/lib/show/catch-up";
import { episodeLabel } from "@/lib/show/schedule";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DISPLAY, PRIMARY, SECONDARY, TEXT_LINK } from "@/lib/ui";

interface CatchUpProps {
  season: string;
  episodes: Episode[];
  episode: Episode;
  onCatchUp: (ep: number) => void;
  children: ReactNode;
}

type Check =
  | { kind: "checking" }
  | { kind: "clear" }
  | { kind: "behind"; open: OverviewEpisode[]; over: boolean; target: number; confirming: boolean };

/**
 * Asks before showing episode N while earlier episodes have unanswered dances:
 * N's roster gives away who went home. Catch up week by week, or skip, which
 * forfeits the earlier dances. A season with nothing left to air offers browse
 * (skip it all) or score from the start instead.
 */
export function CatchUp({ season, episodes, episode, onCatchUp, children }: CatchUpProps) {
  const [check, setCheck] = useState<Check>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    getOverview(season).then(
      (o) => {
        if (cancelled) return;
        const open = unfinishedBefore(o, episode.ep);
        setCheck(
          open.length === 0
            ? { kind: "clear" }
            : { kind: "behind", open, over: o.next === null, target: skipTarget(o, episode.ep), confirming: false },
        );
      },
      // The plan accepts the elimination leak, so a failed check shows the episode.
      () => !cancelled && setCheck({ kind: "clear" }),
    );
    return () => {
      cancelled = true;
    };
  }, [season, episode.ep]);

  if (check.kind === "clear") return children;
  if (check.kind === "checking") {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">Loading the episode...</span>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  const { open, over, target } = check;
  const label = episodeLabel(episode, episodes).toLowerCase();
  const first = episodes.find((e) => e.ep === open[0].ep);
  const firstLabel = first ? episodeLabel(first, episodes).toLowerCase() : `episode ${open[0].ep}`;
  const count = `${open.length} earlier ${open.length === 1 ? "episode" : "episodes"}`;
  const confirm = (confirming: boolean) => setCheck({ ...check, confirming });
  const skip = async () => {
    await skipBefore(season, target);
    setCheck({ kind: "clear" });
  };

  return (
    <section
      aria-labelledby="catch-up-title"
      className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-ballroom to-ink p-5 shadow-[0_24px_80px_-32px_rgb(232_194_104/0.35)] animate-pop-in sm:p-6 md:max-w-2xl"
    >
      <span
        aria-hidden="true"
        className="absolute -top-20 -right-16 size-56 rounded-full bg-[radial-gradient(circle,rgb(232_194_104/0.16),transparent_70%)]"
      />
      <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{over ? "Season over" : "Spoiler ahead"}</p>
      <h1 id="catch-up-title" className={`${DISPLAY} text-3xl leading-tight`}>
        <span className="text-chrome">{over ? "Browse or score this season?" : `You're ${count} behind`}</span>
      </h1>
      {!over && (
        <ul aria-label="Unfinished episodes" className="stagger flex flex-wrap gap-2">
          {open.map((o) => {
            const e = episodes.find((x) => x.ep === o.ep);
            return (
              <li key={o.ep}>
                <Badge tone="gold" className="normal-case tracking-normal">
                  {e ? episodeLabel(e, episodes) : `Episode ${o.ep}`}
                  {o.rateable !== undefined && ` · ${o.answered ?? 0} of ${o.rateable}`}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
      <p className="leading-relaxed text-silver">
        {over
          ? "Browse to see every score and result now, or score it blind from the start, week by week."
          : `Opening ${label} shows who is still dancing, which gives away earlier results. Catch up week by week, or skip what you missed and start here.`}
      </p>
      {check.confirming ? (
        <SkipConfirm
          title={over ? "Browse the whole season?" : `Skip ${count}?`}
          scope={over ? "this season" : `before ${label}`}
          confirmLabel={over ? "Browse the season" : `Skip to ${label}`}
          onConfirm={skip}
          onCancel={() => confirm(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {over ? (
            <>
              <button type="button" onClick={() => confirm(true)} className={PRIMARY}>
                Just browse
              </button>
              <button type="button" onClick={() => onCatchUp(open[0].ep)} className={SECONDARY}>
                Score from the start
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => onCatchUp(open[0].ep)} className={PRIMARY}>
                Catch up on {count}
              </button>
              <button type="button" onClick={() => confirm(true)} className={SECONDARY}>
                Skip to {label}
              </button>
            </>
          )}
        </div>
      )}
      {!over && !check.confirming && (
        <button
          type="button"
          onClick={() => setCheck({ kind: "clear" })}
          className={`${TEXT_LINK} inline-flex min-h-11 items-center self-start text-left`}
        >
          Open {label} and leave {firstLabel} for later
        </button>
      )}
    </section>
  );
}
