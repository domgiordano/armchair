"use client";

import { useEffect, useState, type ReactNode } from "react";

import { getOverview, type OverviewEpisode } from "@/lib/api/overview";
import type { Episode } from "@/lib/api/show";
import { unfinishedBefore } from "@/lib/show/catch-up";
import { useSealedEpisodes } from "@/lib/show/sealed";
import { episodeLabel } from "@/lib/show/schedule";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DISPLAY, PRIMARY, TEXT_LINK } from "@/lib/ui";

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
  | { kind: "behind"; open: OverviewEpisode[]; over: boolean };

/**
 * Asks before showing episode N while earlier episodes still take answers:
 * N's roster gives away who went home. Catch up week by week, or open N anyway.
 * A closed episode doesn't count, its unanswered dances are missed. A finished one
 * whose results or a dance are still face down asks the same way.
 */
export function CatchUp({ season, episodes, episode, onCatchUp, children }: CatchUpProps) {
  const [check, setCheck] = useState<Check>({ kind: "checking" });
  const [anyway, setAnyway] = useState(false);
  const faceDown = useSealedEpisodes(season).filter((e) => e < episode.ep);

  useEffect(() => {
    let cancelled = false;
    getOverview(season).then(
      (o) => {
        if (cancelled) return;
        const open = unfinishedBefore(o, episode.ep);
        setCheck(
          open.length === 0
            ? { kind: "clear" }
            : { kind: "behind", open, over: o.next === null },
        );
      },
      // The plan accepts the elimination leak, so a failed check shows the episode.
      () => !cancelled && setCheck({ kind: "clear" }),
    );
    return () => {
      cancelled = true;
    };
  }, [season, episode.ep]);

  if (check.kind === "clear" && (faceDown.length === 0 || anyway)) return children;
  if (check.kind === "checking") {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">Loading the episode...</span>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  const label = episodeLabel(episode, episodes).toLowerCase();
  if (check.kind === "clear") {
    const held = episodes.find((e) => e.ep === faceDown[0]);
    const heldLabel = held ? episodeLabel(held, episodes) : `Episode ${faceDown[0]}`;
    return (
      <section
        aria-labelledby="catch-up-title"
        className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-ballroom to-ink p-5 shadow-[0_24px_80px_-32px_rgb(232_194_104/0.35)] animate-pop-in sm:p-6 md:max-w-2xl"
      >
        <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Spoiler ahead</p>
        <h1 id="catch-up-title" className={`${DISPLAY} text-3xl leading-tight`}>
          <span className="text-chrome">{heldLabel} is still face down</span>
        </h1>
        <p className="leading-relaxed text-silver">
          You haven&apos;t revealed who went home in {heldLabel.toLowerCase()}. Opening {label} shows who is still
          dancing, which gives it away.
        </p>
        <button type="button" onClick={() => onCatchUp(faceDown[0])} className={`${PRIMARY} self-start`}>
          Go to {heldLabel.toLowerCase()}
        </button>
        <button
          type="button"
          onClick={() => setAnyway(true)}
          className={`${TEXT_LINK} inline-flex min-h-11 items-center self-start text-left`}
        >
          Open {label} anyway
        </button>
      </section>
    );
  }

  const { open, over } = check;
  const first = episodes.find((e) => e.ep === open[0].ep);
  const firstLabel = first ? episodeLabel(first, episodes).toLowerCase() : `episode ${open[0].ep}`;
  const count = `${open.length} earlier ${open.length === 1 ? "episode" : "episodes"}`;

  return (
    <section
      aria-labelledby="catch-up-title"
      className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-ballroom to-ink p-5 shadow-[0_24px_80px_-32px_rgb(232_194_104/0.35)] animate-pop-in sm:p-6 md:max-w-2xl"
    >
      <span
        aria-hidden="true"
        className="absolute -top-20 -right-16 size-56 rounded-full bg-[radial-gradient(circle,rgb(232_194_104/0.16),transparent_70%)]"
      />
      <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Spoiler ahead</p>
      <h1 id="catch-up-title" className={`${DISPLAY} text-3xl leading-tight`}>
        <span className="text-chrome">You&apos;re {count} behind</span>
      </h1>
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
      <p className="leading-relaxed text-silver">
        Opening {label} shows who is still dancing, which gives away earlier results.{" "}
        {over ? "Score from the start, week by week, or open it anyway." : "Catch up week by week, or open it anyway."}
      </p>
      <button type="button" onClick={() => onCatchUp(open[0].ep)} className={`${PRIMARY} self-start`}>
        {over ? "Score from the start" : `Catch up on ${count}`}
      </button>
      <button
        type="button"
        onClick={() => {
          setCheck({ kind: "clear" });
          setAnyway(true);
        }}
        className={`${TEXT_LINK} inline-flex min-h-11 items-center self-start text-left`}
      >
        Open {label} and leave {firstLabel} for later
      </button>
    </section>
  );
}
