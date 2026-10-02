"use client";

import { useSeasonView } from "@/components/season-data";
import { Headshot } from "@/components/ui/avatar";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useEpisode } from "@/lib/use-episode";
import { cn, HEADING } from "@/lib/ui";

/**
 * The whole cast, from episode 1's roster. A later roster would show who's gone,
 * which spoils episodes you haven't called yet.
 */
export function PlayersScreen() {
  const { view } = useSeasonView();
  const { load, retry } = useEpisode(view.season, view.episodes[0]?.ep ?? null);
  const heading = <h1 className={cn(HEADING, "text-2xl")}>The players</h1>;

  if (view.episodes.length === 0) {
    return (
      <>
        {heading}
        <EmptyState title="No cast yet">The players appear once the season is announced.</EmptyState>
      </>
    );
  }
  return (
    <>
      {heading}
      {load.kind === "loading" && <SkeletonList label="Gathering the players" rows={4} row="h-24" />}
      {load.kind === "error" && <ErrorState what="the players" message={load.message} retry={retry} />}
      {load.kind === "ready" && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {load.episode.roster.map((p) => (
            <li key={p.id} className="flex flex-col items-center gap-2 text-center">
              <Headshot name={p.name} image={p.headshot} size={84} className="shadow-[0_8px_18px_-8px_rgb(0_0_0/0.9)]" />
              <span className="text-sm leading-tight text-bone">{p.name}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
