import Link from "next/link";
import type { ReactNode } from "react";

import { playerHref } from "@/lib/history";
import { showOf } from "@/lib/seasons";
import { cn, TEXT_LINK } from "@/lib/ui";

/** A player's name as a link to their page, keeping the season the reader is in. */
export function PlayerLink({ season, id, children, className }: { season: string; id: string; children: ReactNode; className?: string }) {
  return (
    <Link href={playerHref(showOf(season), id, season)} className={cn(TEXT_LINK, className)}>
      {children}
    </Link>
  );
}

export const seasonPlayerHref = (season: string) => (id: string) => playerHref(showOf(season), id, season);
