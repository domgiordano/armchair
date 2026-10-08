"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { PlayerSheet } from "@/components/player-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlayer, type PlayerProfile } from "@/lib/api/history";
import { cleanBio } from "@/lib/bio";
import { seasonName, seasonNumber, showOf } from "@/lib/seasons";
import { cn, EYEBROW, HEADING, TEXT_LINK } from "@/lib/ui";

// Long enough that turning past a seat doesn't fetch it.
const SETTLE = 250;

type Load = { id: string; profile: PlayerProfile | null };

/** The player's page once the table stops on them; null while it loads, a null profile if it failed. */
function useProfile(season: string, id: string): Load | null {
  const [load, setLoad] = useState<Load | null>(null);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      getPlayer(showOf(season), id).then(
        (profile) => !cancelled && setLoad({ id, profile }),
        // The card still has the name and how they did; only the bio goes missing.
        () => !cancelled && setLoad({ id, profile: null }),
      );
    }, SETTLE);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [season, id]);
  return load?.id === id ? load : null;
}

interface FocusCardProps {
  id: string;
  name: string;
  headshot: string | null;
  season: string;
  /** How they're doing, only as far as the table's own data says. */
  status: string[];
  /** An unmasked Traitor: the status is read in red. */
  unmasked: boolean;
  /** Their page, linked from the profile; left out while you're picking. */
  href?: string;
  actions?: ReactNode;
  className?: string;
}

/** Who is at the head of the table: their season, how they're doing, who they are and the start of their story. */
export function FocusCard({ id, name, headshot, season, status, unmasked, href, actions, className }: FocusCardProps) {
  const load = useProfile(season, id);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const edition = seasonName({ id: season, number: seasonNumber(season), title: null });
  const about = load?.profile?.about;
  const bio = load?.profile?.bio?.text;
  // Back to the button once the sheet is gone: while it's up, the page under it is inert.
  const shown = useRef(false);
  useEffect(() => {
    if (open) shown.current = true;
    else if (shown.current) opener.current?.focus();
  }, [open]);

  return (
    <section aria-label={`At the head of the table: ${name}`} className={cn("flex min-w-0 flex-col gap-1", className)}>
      <p className={cn(EYEBROW, "truncate")}>
        {edition.eyebrow} · {edition.title}
      </p>
      <h3 className={cn(HEADING, "truncate text-xl leading-tight")}>{name}</h3>
      <p className={cn("min-h-5 truncate text-sm leading-5", unmasked ? "text-blood-hi" : "text-parchment")}>
        {status.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" · ")}
      </p>
      {load === null ? (
        <span aria-hidden="true" className="flex min-h-[4.5rem] flex-col gap-1.5 pt-1">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </span>
      ) : (
        <>
          <p className="min-h-5 truncate text-sm leading-5 text-ash">
            {[about?.age, about?.hometown, about?.occupation].filter(Boolean).join(" · ")}
          </p>
          <p className="line-clamp-2 min-h-12 leading-6 text-parchment @4xl:line-clamp-6">
            {bio ? cleanBio(bio) : <span className="text-ash italic">{load.profile ? "No biography yet." : "Their story couldn't load."}</span>}
          </p>
        </>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
        {actions}
        <button
          ref={opener}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className={cn(TEXT_LINK, "inline-flex min-h-11 items-center")}
        >
          Full profile<span className="sr-only">: {name}</span>
        </button>
      </div>
      {open && (
        <PlayerSheet
          open
          onClose={() => setOpen(false)}
          name={name}
          headshot={headshot}
          edition={`${edition.eyebrow} · ${edition.title}`}
          status={status}
          unmasked={unmasked}
          profile={load?.profile ?? null}
          loading={load === null}
          href={href}
          actions={actions}
        />
      )}
    </section>
  );
}
