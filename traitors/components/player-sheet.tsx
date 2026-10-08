"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Credit } from "@/components/writeup";
import { Headshot } from "@/components/ui/avatar";
import { CloseIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import type { PlayerProfile } from "@/lib/api/history";
import { cleanBio } from "@/lib/bio";
import { cn, EYEBROW, HEADING, ICON_BUTTON, TEXT_LINK } from "@/lib/ui";

interface PlayerSheetProps {
  open: boolean;
  onClose: () => void;
  name: string;
  headshot: string | null;
  edition: string;
  /** How they're doing, as far as the table you're at says. */
  status: string[];
  unmasked: boolean;
  /** Null while it loads, or when it failed. */
  profile: PlayerProfile | null;
  loading: boolean;
  /** Their page; left out while picking, where leaving would drop your picks. */
  href?: string;
  /** The same calls the table offers for them. */
  actions?: ReactNode;
}

/** Everything about the player at the head of the table, without leaving it. */
export function PlayerSheet({ open, onClose, name, headshot, edition, status, unmasked, profile, loading, href, actions }: PlayerSheetProps) {
  const about = profile?.about;
  const facts = [about?.age && `${about.age}`, about?.occupation, about?.hometown].filter(Boolean);
  const bio = profile?.bio;

  return (
    <Sheet open={open} onClose={onClose} label={`About ${name}`}>
      <div className="-mb-3 flex justify-end">
        <button type="button" aria-label="Close" onClick={onClose} className={ICON_BUTTON}>
          <CloseIcon />
        </button>
      </div>
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:text-left">
        <Headshot
          name={name}
          image={headshot}
          size={160}
          className="shrink-0 shadow-[0_14px_30px_-12px_rgb(0_0_0/0.95)]"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <p className={EYEBROW}>{edition}</p>
          <h2 className={cn(HEADING, "text-3xl leading-tight")}>{name}</h2>
          {facts.length > 0 && <p className="text-parchment">{facts.join(" · ")}</p>}
          {status.length > 0 && (
            <p className={cn("text-sm", unmasked ? "text-blood-hi" : "text-candle")}>
              {status.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" · ")}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap justify-center gap-2 sm:justify-start">{actions}</div>}
      <section aria-label="Biography" className="flex flex-col gap-2 border-t border-gilt/20 pt-4">
        {bio ? (
          <>
            <p className="text-lg leading-relaxed whitespace-pre-line text-parchment">{cleanBio(bio.text)}</p>
            <Credit writeup={bio} />
          </>
        ) : (
          <p className="text-ash italic">
            {loading ? "Finding their story..." : profile ? "No biography yet." : "Their story couldn't load."}
          </p>
        )}
      </section>
      {href && (
        <Link href={href} className={cn(TEXT_LINK, "inline-flex min-h-11 items-center self-start")}>
          Their full page: every season, episode by episode
        </Link>
      )}
    </Sheet>
  );
}
