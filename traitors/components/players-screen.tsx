"use client";

import { CastTable } from "@/components/cast-wall";
import { seasonPlayerHref } from "@/components/player-link";
import { useSeasonView } from "@/components/season-data";
import { EmptyState } from "@/components/ui/states";
import { cn, HEADING } from "@/lib/ui";

/** The whole cast in its order, crossed off only where the season's results are yours to see. */
export function PlayersScreen() {
  const { view } = useSeasonView();
  const cast = [...view.cast].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <h1 className={cn(HEADING, "text-2xl")}>The players</h1>
      {cast.length === 0 ? (
        <EmptyState title="No cast yet">The players appear once the season is announced.</EmptyState>
      ) : (
        <CastTable players={cast} hrefOf={seasonPlayerHref(view.season)} season={view.season} />
      )}
    </>
  );
}
