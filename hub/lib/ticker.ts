import type { TickerItem } from "@/components/ticker";

import { ApiError, request } from "./api/client";
import { currentSeason, getBoard, listSeasons } from "./api/dwts";
import { EDITION_NAMES, getRanks, getTraitorsSeason, type Edition } from "./api/traitors";
import type { CatalogCounts } from "./catalog";

// Nothing here may spoil a result: no one's exit, no episode's scores. Only
// schedules, archive sizes and the players' own leaderboard.

/** The signed-out band: what's on and how it plays. `counts` is the DWTS catalog, read at build. */
export function staticTickerItems(counts?: CatalogCounts): TickerItem[] {
  const archive: TickerItem[] = counts
    ? [
        { key: "archive", label: "Archive", text: `${counts.seasons} DWTS seasons, ${counts.firstYear} to ${counts.lastYear}` },
        { key: "dances", label: "Dances", text: `${counts.performances.toLocaleString("en-US")} performances to score` },
      ]
    : [];
  return [
    { key: "dwts", label: "Dancing with the Stars", text: "Live on the East Coast, 8 to 10 PM ET" },
    { key: "traitors", label: "The Traitors", text: "US and UK. Picks lock when each episode drops" },
    ...archive.slice(0, 1),
    { key: "rule", label: "The rule", text: "Call it blind. The reveal comes after" },
    ...archive.slice(1),
    { key: "survivor", label: "Survivor", text: "In rehearsal" },
    { key: "account", label: "Free", text: "One Google sign-in for every show" },
  ];
}

const today = () => new Date().toLocaleDateString("en-CA");

/** "tonight", "tomorrow" or "in 4 days", from a YYYY-MM-DD calendar date. */
export function countdown(date: string, from: string = today()): string {
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
  if (days <= 0) return "tonight";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

const ahead = (rank: number, total: number) =>
  total - rank > 0 ? `, ahead of ${total - rank} ${total - rank === 1 ? "player" : "players"}` : "";

async function dwtsItems(): Promise<TickerItem[]> {
  const seasons = await listSeasons();
  const season = currentSeason(seasons);
  if (!season) return [];
  const [schedule, board] = await Promise.all([
    request<{ episodes: { ep: number; airDate?: string }[] }>(`/seasons/get?season=${encodeURIComponent(season.id)}`),
    getBoard(season.id, "global"),
  ]);
  const label = `DWTS S${season.number}`;
  const items: TickerItem[] = [];
  const next = schedule.episodes.find((e) => e.airDate && e.airDate >= today());
  if (next?.airDate) {
    const day = new Date(`${next.airDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    items.push({ key: "dwts-next", label, text: `Episode ${next.ep} airs ${countdown(next.airDate)}, ${day}` });
  }
  const leader = board.ranked[0];
  if (leader) {
    const who = leader.sub === board.me.sub ? "You lead the room" : `${leader.name ?? "Someone"} leads the room`;
    items.push({ key: "dwts-leader", label, text: `${who}, ${leader.mae.toFixed(2)} points off the judges` });
  }
  if (board.me.rank !== null) {
    items.push({ key: "dwts-me", label, text: `You're #${board.me.rank} of ${board.total}${ahead(board.me.rank, board.total)}` });
  }
  items.push({ key: "dwts-archive", label: "Archive", text: `${seasons.length} DWTS seasons in the archive` });
  return items;
}

const EDITIONS: Edition[] = ["tus", "tuk", "tukc"];

async function traitorsSeasonItems(show: Edition, id: string, number: number): Promise<TickerItem[]> {
  const label = `Traitors ${EDITION_NAMES[show]} S${number}`;
  try {
    const [view, ranks] = await Promise.all([getTraitorsSeason(id), getRanks(id, show, "global")]);
    const items: TickerItem[] = [];
    if (view.needsBet) {
      items.push({ key: `${id}-bet`, label, text: "Lock in your winners to open the episodes" });
    } else {
      const next = view.episodes.find((e) => Date.parse(e.releaseAt) > Date.now());
      if (next) {
        const at = new Date(next.releaseAt);
        const when = at.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
        items.push({ key: `${id}-next`, label, text: `Episode ${next.ep} drops ${countdown(at.toLocaleDateString("en-CA"))}, ${when}` });
      }
    }
    const leader = ranks.ranked[0];
    if (leader && leader.points > 0) {
      const who = leader.sub === ranks.me.sub ? "You lead" : `${leader.name ?? "Someone"} leads`;
      items.push({ key: `${id}-leader`, label, text: `${who} with ${leader.points} points` });
    }
    if (ranks.me.events > 0) {
      items.push({ key: `${id}-me`, label, text: `You're #${ranks.me.rank} of ${ranks.total}${ahead(ranks.me.rank, ranks.total)}` });
    }
    return items;
  } catch (e) {
    // A season the API won't show yet (403, 404) is left out, as on its dashboard card.
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return [];
    throw e;
  }
}

async function traitorsItems(): Promise<TickerItem[]> {
  const lists = await Promise.all(EDITIONS.map((show) => listTraitorsSeasons(show)));
  const current = lists.flatMap((seasons, i) => seasons.filter((s) => s.current).map((s) => ({ ...s, show: EDITIONS[i] })));
  const perSeason = await Promise.all(current.map((s) => traitorsSeasonItems(s.show, s.id, s.number)));
  const total = lists.reduce((n, seasons) => n + seasons.length, 0);
  return [...perSeason.flat(), { key: "traitors-archive", label: "Archive", text: `${total} Traitors seasons in the archive` }];
}

const listTraitorsSeasons = async (show: Edition) =>
  (await request<{ seasons: { id: string; number: number; current: boolean }[] }>(`/seasons/list?show=${show}`)).seasons;

/** The signed-in band, from the member's own seasons. One show failing leaves the other's items. */
export async function getTickerItems(): Promise<TickerItem[]> {
  const results = await Promise.allSettled([dwtsItems(), traitorsItems()]);
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length === results.length) throw failed[0].reason;
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
