"use client";

import Link from "next/link";

import { useSeasonView } from "@/components/season-data";
import { EmptyState } from "@/components/ui/states";
import { YourPicks } from "@/components/your-picks";
import type { SeasonEpisode } from "@/lib/api/traitors";
import { roman } from "@/lib/players";
import { episodeLabel, formatRelease, released } from "@/lib/schedule";
import { withSeason } from "@/lib/seasons";
import { cn, FOCUS, HEADING } from "@/lib/ui";
import { useNow } from "@armchair/app-core/show/use-now";

export function EpisodesScreen() {
  const { view } = useSeasonView();
  const now = useNow();

  return (
    <section aria-labelledby="episodes-title" className="flex flex-col gap-4">
      <h1 id="episodes-title" className={cn(HEADING, "text-2xl")}>
        Episodes
      </h1>
      {view.episodes.length === 0 ? (
        <EmptyState title="No episodes yet">The schedule appears once the season is announced.</EmptyState>
      ) : (
        <ol className="flex flex-col gap-2">
          {view.episodes.map((e) => (
            <li key={e.ep}>
              <Link
                href={withSeason(`/episode/?ep=${e.ep}`, view.season)}
                className={cn(
                  FOCUS,
                  "group flex items-center gap-3 rounded-sm border border-gilt/25 bg-stone/85 p-2.5 pr-3 transition-colors hover:border-gilt hover:bg-cloak active:bg-cloak-500",
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex size-12 shrink-0 items-center justify-center rounded-sm border border-gilt/60 bg-night font-display text-sm font-semibold text-candle"
                >
                  {roman(e.ep)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-display tracking-[0.04em] text-bone">{episodeLabel(e)}</span>
                  <span className="truncate text-sm text-ash">
                    {e.title && `Episode ${e.ep} · `}
                    {formatRelease(e.releaseAt)}
                  </span>
                  <YourPicks mine={e.mine} players={view.cast} className="pt-1" />
                </span>
                <Status episode={e} now={now} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Status({ episode: e, now }: { episode: SeasonEpisode; now: number }) {
  const pill = "shrink-0 rounded-sm border px-2 py-0.5 font-display text-xs font-semibold tracking-[0.1em] uppercase";
  if (e.closed) return <span className={cn(pill, "border-ash-dim text-ash")}>Closed</span>;
  if (!released(e, now)) return <span className={cn(pill, "border-gilt/40 text-parchment")}>Soon</span>;
  if (e.answered >= e.events) {
    return (
      <span className={cn(pill, "border-moss/60 text-moss")}>
        <span className="nums">{e.answered}</span>/<span className="nums">{e.events}</span> called
      </span>
    );
  }
  return (
    <span className={cn(pill, "border-ember bg-ember text-night")}>
      Call it · <span className="nums">{e.answered}</span>/<span className="nums">{e.events}</span>
    </span>
  );
}
