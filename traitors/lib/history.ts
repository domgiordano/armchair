import type { Exit, HistoryEpisode, HistoryPlayer } from "@/lib/api/history";
import { withSeason, type Show } from "@/lib/seasons";

/** "Winner", "Banished ep 4", "Murdered ep 2". */
export function finishText(exit: Exit | null): string | null {
  if (!exit?.how) return null;
  if (exit.how === "winner") return "Winner";
  return `${exit.how.charAt(0).toUpperCase()}${exit.how.slice(1)} ep ${exit.ep}`;
}

/**
 * Who sat at episode `ep`'s round table: everyone still in, less that morning's
 * murders. Whoever left at this table, banished or winning, was at it.
 */
export function seatedAt(players: HistoryPlayer[], episode: HistoryEpisode): HistoryPlayer[] {
  const gone = new Set(episode.murdered ?? []);
  return players.filter(
    (p) => !gone.has(p.id) && (!p.exit || p.exit.ep > episode.ep || (p.exit.ep === episode.ep && p.exit.how !== "murdered")),
  );
}

/** Winners first, then whoever lasted longest. */
export function byFinish(players: HistoryPlayer[]): HistoryPlayer[] {
  const lasted = (p: HistoryPlayer) => (p.exit?.how === "winner" ? 1001 : (p.exit?.ep ?? 1000));
  return [...players].sort((a, b) => lasted(b) - lasted(a) || a.name.localeCompare(b.name));
}

/** A player's page, keeping the season so the shell stays on the same edition. */
export function playerHref(show: Show, id: string, season: string | null): string {
  const href = `/players/player/?${new URLSearchParams({ show, id })}`;
  return season ? withSeason(href, season) : href;
}

const UNITS: Record<Show, [string, string]> = {
  tus: ["Season", "Seasons"],
  tuk: ["Series", "Series"],
  tukc: ["Celebrity series", "Celebrity series"],
};

/** "Season 3", "Seasons 1 and 3", "Series 1, 2 and 4". */
export function seasonsText(show: Show, numbers: number[]): string {
  const [one, many] = UNITS[show];
  const ns = [...numbers].sort((a, b) => a - b);
  if (ns.length === 1) return `${one} ${ns[0]}`;
  return `${many} ${ns.slice(0, -1).join(", ")} and ${ns.at(-1)}`;
}
