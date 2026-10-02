"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { getSeasons } from "@/lib/api/seasons";
import {
  EDITIONS,
  editionOf,
  isSeasonId,
  mergeSeasons,
  pickSeason,
  withSeason,
  type Edition,
  type SeasonSummary,
} from "@/lib/seasons";

const KEY = "armchair.traitors.edition";

// Storage throws when disabled (Safari private mode); the edition then lasts the tab.
function readEdition(): Edition {
  try {
    return window.localStorage.getItem(KEY) === "uk" ? "uk" : "us";
  } catch {
    return "us";
  }
}

function saveEdition(edition: Edition): void {
  try {
    window.localStorage.setItem(KEY, edition);
  } catch {
    // See readEdition.
  }
}

export interface ShellSeason {
  edition: Edition;
  /** Null until the edition's season list says which one is live. */
  season: string | null;
  /** The edition's seasons, null while loading. */
  seasons: SeasonSummary[] | null;
  failed: boolean;
  retry: () => void;
  chooseEdition: (edition: Edition) => void;
  chooseSeason: (id: string) => void;
}

const SeasonContext = createContext<ShellSeason | null>(null);

export function useShellSeason(): ShellSeason {
  const value = useContext(SeasonContext);
  if (!value) throw new Error("useShellSeason needs a SeasonProvider");
  return value;
}

/** The season every signed-in page shows. The shell renders pages only once it's known. */
export function useSeasonId(): string {
  const { season } = useShellSeason();
  if (season === null) throw new Error("useSeasonId before the season resolved");
  return season;
}

/**
 * The season lives in the URL (`?season=tus-5`), so links and reloads keep it. With
 * none, it's the remembered edition's live season, so a new season needs no code change.
 */
export function SeasonProvider({ children, home }: { children: ReactNode; home?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const asked = useSearchParams().get("season");
  const [preferred, setPreferred] = useState(readEdition);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<{ key: string; seasons: SeasonSummary[] | null } | null>(null);

  const edition = isSeasonId(asked) ? editionOf(asked) : preferred;
  const key = `${edition}#${attempt}`;

  useEffect(() => {
    let cancelled = false;
    Promise.all(EDITIONS[edition].map(getSeasons)).then(
      (lists) => !cancelled && setLoad({ key, seasons: mergeSeasons(lists) }),
      () => !cancelled && setLoad({ key, seasons: null }),
    );
    return () => {
      cancelled = true;
    };
  }, [edition, key]);

  const seasons = load?.key === key ? load.seasons : null;
  const value: ShellSeason = {
    edition,
    season: pickSeason(asked, seasons ?? []),
    seasons,
    failed: load?.key === key && load.seasons === null,
    retry: () => setAttempt((n) => n + 1),
    chooseEdition: (next) => {
      if (next === edition) return;
      saveEdition(next);
      setPreferred(next);
      // Every other param belongs to the old season: its episode 5 isn't this one's.
      router.push(home ?? pathname);
    },
    chooseSeason: (id) => router.push(withSeason(home ?? pathname, id)),
  };

  return <SeasonContext value={value}>{children}</SeasonContext>;
}
