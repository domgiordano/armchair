"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useScoreTarget } from "@/components/score-cta";
import { Sheet } from "@/components/ui/sheet";
import { localDate, reminderFor } from "@/lib/show/reminder";
import { episodeLabel } from "@/lib/show/schedule";
import { withSeason } from "@/lib/show/seasons";
import { closesOn } from "@/lib/show/window";
import { useNow } from "@armchair/app-core/show/use-now";
import { button, cn, FOCUS } from "@/lib/ui";

const BANNER_KEY = "armchair.reminder.dismissed";
const SHEET_KEY = "armchair.reminder.shown";

// Storage throws when disabled (Safari private mode): the banner then comes back
// on reload, and the sheet may show more than once a day. Neither blocks anything.
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // See read().
  }
}

/** Show night and the day after: a banner on every page, and once a day a sheet, until the episode is scored. */
export function Reminders({ onScorecard }: { onScorecard: boolean }) {
  // The scorecard is where both would send you.
  return onScorecard ? null : <Due />;
}

function Due() {
  const { target, overview, season } = useScoreTarget();
  const now = useNow();
  const due = overview ? reminderFor(target, overview.timezone, now) : null;
  const id = due && `${season}|${due.episode.ep}`;
  const today = overview ? localDate(now, overview.timezone) : null;
  // Read once per page: a sheet shown here must stay up even after the date is written.
  const [dismissed, setDismissed] = useState(() => read(BANNER_KEY));
  const [shownOn] = useState(() => read(SHEET_KEY));
  const [closed, setClosed] = useState(false);
  const sheet = !closed && due !== null && today !== null && shownOn !== today;

  const go = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!sheet || !today) return;
    write(SHEET_KEY, today);
    // WebKit's showModal focuses the close button; the likely next tap is Score.
    go.current?.focus();
  }, [sheet, today]);

  if (!due || !overview) return null;

  const name = [episodeLabel(due.episode, overview.episodes), due.episode.theme].filter(Boolean).join(" · ");
  const href = withSeason(`/episode/?ep=${due.episode.ep}`, season);
  const left = due.rateable ? due.rateable - (due.answered ?? 0) : null;
  const tonight = due.episode.airDate === today;
  const closes = due.closesAt && closesOn(due.closesAt, overview.timezone);

  return (
    <>
      {dismissed !== id && (
        <div className="border-b border-gold/25 bg-gradient-to-r from-gold/[0.12] via-ballroom/80 to-ballroom/60">
          <section
            aria-label="Reminder"
            className="mx-auto flex max-w-6xl animate-fade-in items-center gap-3 py-1.5 pr-1 pl-4 sm:pl-6"
          >
            <BellIcon />
            <p className="min-w-0 flex-1 text-sm text-pearl">
              Don&apos;t forget to score <span className="font-semibold">{name}</span>
              {left !== null && <span className="text-silver-dim"> · {left} left</span>}
              {closes && <span className="text-silver-dim"> · closes {closes}</span>}
            </p>
            <Link href={href} className={cn(button("primary", "sm"), "shrink-0")}>
              Score
            </Link>
            <button
              type="button"
              aria-label="Dismiss reminder"
              onClick={() => {
                if (id) write(BANNER_KEY, id);
                setDismissed(id);
              }}
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full text-silver transition-colors hover:bg-silver/10 hover:text-pearl active:bg-silver/15",
                FOCUS,
              )}
            >
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </section>
        </div>
      )}
      <Sheet open={sheet} onClose={() => setClosed(true)} label="Reminder">
        <div className="flex flex-col items-center gap-4 pt-2 text-center">
          <span className="flex size-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold-light">
            <BellIcon large />
          </span>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{tonight ? "Tonight's show" : "Last night's show"}</p>
            <h2 className="text-xl font-semibold text-pearl">Don&apos;t forget your scores</h2>
            <p className="text-sm text-silver-dim">
              {name}:{" "}
              {left === null ? "score each dance before you see the judges." : `${left} ${left === 1 ? "dance still needs" : "dances still need"} your paddle.`}
              {closes && ` Scoring closes ${closes}.`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row-reverse sm:justify-center">
            <Link ref={go} href={href} onClick={() => setClosed(true)} className={button("primary")}>
              Score this week&apos;s show
            </Link>
            <button type="button" onClick={() => setClosed(true)} className={button("secondary")}>
              Later
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

function BellIcon({ large = false }: { large?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("shrink-0 text-gold-light", large ? "size-7" : "size-5")}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  );
}
