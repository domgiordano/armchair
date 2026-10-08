"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Seal } from "@/components/ui/wax-seal";
import { revealEpisode, useFaceDown } from "@/lib/sealed";
import { withSeason } from "@/lib/seasons";
import { button, cn, EYEBROW, HEADING } from "@/lib/ui";

interface RevealSheetProps {
  /** The call just sealed, or null when the sheet is closed. */
  locked: { what: string; ep: number } | null;
  onReveal: () => void;
  onClose: () => void;
}

/** After a seal: turn the result over now, or wait until you've watched it. */
export function RevealSheet({ locked, onReveal, onClose }: RevealSheetProps) {
  const reveal = useRef<HTMLButtonElement>(null);
  const open = locked !== null;
  // WebKit's showModal ignores autoFocus; Reveal is the likely next tap.
  useEffect(() => {
    if (open) reveal.current?.focus();
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} label="Locked in">
      {locked && (
        <div className="flex flex-col items-center gap-5 pt-2 text-center">
          <Seal className="size-20 animate-stamp drop-shadow-[0_6px_10px_rgb(0_0_0/0.6)]" />
          <div className="flex flex-col gap-1.5">
            <p className={EYEBROW}>Locked in</p>
            <h2 className={cn(HEADING, "text-2xl")}>Ready to see what happened?</h2>
            <p className="text-parchment">
              {locked.what} is sealed. If you haven&apos;t watched episode {locked.ep} yet, keep it face down: nothing
              here gives it away until you turn it over.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row-reverse sm:justify-center">
            <button ref={reveal} type="button" onClick={onReveal} className={button("gold")}>
              Reveal what happened
            </button>
            <button type="button" onClick={onClose} className={button("outline")}>
              Not yet
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

interface FaceDownNoticeProps {
  season: string;
  ep: number;
  /** What would give the episode away: "Your points", "The board". */
  what: string;
  /** Inside a card or list: no frame of its own. */
  bare?: boolean;
  /** Off on the episode's own page. */
  link?: boolean;
  className?: string;
}

/** Stands in for anything that would spoil an episode whose calls are still face down. */
export function FaceDownNotice({ season, ep, what, bare = false, link = true, className }: FaceDownNoticeProps) {
  const body = (
    <>
      <Seal className="size-10 shrink-0" />
      <div className="flex min-w-0 flex-col items-start gap-2">
        <p className={EYEBROW}>Face down</p>
        <p className="text-parchment">
          {what} would give away episode {ep}, and your calls for it are still face down.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => revealEpisode(season, ep)} className={button("gold", "sm")}>
            Reveal episode {ep}
          </button>
          {link && (
            <Link href={withSeason(`/episode/?ep=${ep}`, season)} className={button("outline", "sm")}>
              Go to episode {ep}
            </Link>
          )}
        </div>
      </div>
    </>
  );
  if (bare) return <div className={cn("flex items-start gap-3", className)}>{body}</div>;
  return (
    <Card tone="cloak" className={cn("flex items-start gap-3", className)}>
      {body}
    </Card>
  );
}

interface FaceDownBeforeProps {
  season: string;
  ep: number;
  children: ReactNode;
}

/**
 * Asks before opening an episode while an earlier one is face down: who is still
 * at the table gives away who left. Turn the earlier one over, or open this anyway.
 */
export function FaceDownBefore({ season, ep, children }: FaceDownBeforeProps) {
  const [dismissed, setDismissed] = useState(false);
  const earlier = useFaceDown(season).eps.filter((e) => e < ep);
  if (dismissed || earlier.length === 0) return children;

  const first = earlier[0];
  return (
    <Card as="section" tone="cloak" tartan aria-labelledby="face-down-title" className="flex animate-pop-in flex-col gap-4 p-5">
      <p className={cn(EYEBROW, "text-ember")}>Spoiler ahead</p>
      <h2 id="face-down-title" className={cn(HEADING, "text-2xl")}>
        Episode {first} is still face down
      </h2>
      <p className="leading-relaxed text-parchment">
        Your calls for {earlier.length === 1 ? `episode ${first} are` : `episodes ${earlier.join(", ")} are`} locked in
        but not revealed. Episode {ep} shows who is still in the castle, which gives away what happened.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => earlier.forEach((e) => revealEpisode(season, e))} className={button("gold")}>
          Reveal {earlier.length === 1 ? `episode ${first}` : "them"}
        </button>
        <button type="button" onClick={() => setDismissed(true)} className={button("outline")}>
          Open it anyway
        </button>
      </div>
    </Card>
  );
}
