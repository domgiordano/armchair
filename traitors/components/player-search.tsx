"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { errorText } from "@/components/season-data";
import { useShellSeason } from "@/components/season-provider";
import { Headshot } from "@/components/ui/avatar";
import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/states";
import { SEARCH_MIN, searchPlayers, type PlayerHit } from "@/lib/api/history";
import { playerHref, seasonsText } from "@/lib/history";
import { EDITIONS, type Show } from "@/lib/seasons";
import { cn, EYEBROW, FOCUS, ICON_BUTTON } from "@/lib/ui";

const DELAY_MS = 250;

/** The header's search button, and the sheet it opens: every player in the edition's seasons. */
export function PlayerSearch() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="Search players"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={ICON_BUTTON}
      >
        <SearchIcon />
      </button>
      <Sheet open={open} onClose={close} label="Search players">
        {/* Mounted only while open, so each search starts empty. */}
        {open && <SearchPanel onClose={close} onPick={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

interface Hit extends PlayerHit {
  show: Show;
}

interface Found {
  q: string;
  hits: Hit[];
  error: string | null;
}

function SearchPanel({ onClose, onPick }: { onClose: () => void; onPick: () => void }) {
  const { edition, season } = useShellSeason();
  const id = useId();
  const [q, setQ] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [found, setFound] = useState<Found | null>(null);
  const query = q.trim();
  const short = query.length < SEARCH_MIN;

  useEffect(() => {
    if (short) return;
    let cancelled = false;
    const t = setTimeout(() => {
      // UK searches its civilian and celebrity series at once: a name may be in either.
      Promise.all(EDITIONS[edition].map((show) => searchPlayers(show, query).then((ps) => ps.map((p) => ({ ...p, show }))))).then(
        (lists) => !cancelled && setFound({ q: query, hits: lists.flat(), error: null }),
        (e: unknown) => !cancelled && setFound({ q: query, hits: [], error: errorText(e) }),
      );
    }, DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [edition, query, short, attempt]);

  const busy = !short && found?.q !== query;
  // While the next answer is on its way, the last one stays up rather than flashing empty.
  const hits = short ? [] : (found?.hits ?? []);
  const status = short
    ? `Type at least ${SEARCH_MIN} letters of a name.`
    : busy
      ? "Searching..."
      : found?.error
        ? ""
        : hits.length === 0
          ? `No players called "${query}".`
          : `${hits.length} ${hits.length === 1 ? "player" : "players"}`;

  return (
    <>
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor={id} className={EYEBROW}>
            Search players
          </label>
          {/* First focusable in the dialog, so opening the sheet puts the cursor here. */}
          <input
            id={id}
            type="search"
            value={q}
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            placeholder="Start typing a name"
            onChange={(e) => setQ(e.target.value)}
            className={cn(
              FOCUS,
              "min-h-11 w-full rounded-sm border border-ash-dim bg-night px-3 text-bone [&::-webkit-search-cancel-button]:appearance-none transition-colors placeholder:text-ash-dim hover:border-gilt/70 focus:border-gilt",
            )}
          />
        </div>
        <button type="button" aria-label="Close search" onClick={onClose} className={ICON_BUTTON}>
          <CloseIcon />
        </button>
      </div>
      <p role="status" className={cn("text-sm text-ash", busy && "animate-pulse")}>
        {status}
      </p>
      {!busy && found?.error && (
        <ErrorState what="players" message={found.error} retry={() => setAttempt((n) => n + 1)} />
      )}
      {hits.length > 0 && (
        <ul aria-label="Players" className={cn("-mx-2 flex flex-col gap-1 transition-opacity", busy && "opacity-60")}>
          {hits.map((p) => (
            <li key={`${p.show}#${p.id}`}>
              <Link
                href={playerHref(p.show, p.id, season)}
                onClick={onPick}
                className={`${FOCUS} flex min-h-14 items-center gap-3 rounded-sm px-2 py-1.5 transition-colors hover:bg-cloak active:bg-cloak/70`}
              >
                <span aria-hidden="true">
                  <Headshot name={p.name} image={p.headshot} size={44} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-bone">{p.name}</span>
                  <span className="truncate text-sm text-ash">{seasonsText(p.show, p.seasons)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
