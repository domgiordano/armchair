import { getPerformers } from "@/lib/api/couples";
import { getGroupDetails, getMyGroups } from "@/lib/api/groups";
import { ALL_TIME, getLeaderboard } from "@/lib/api/leaderboard";
import { getOverview } from "@/lib/api/overview";
import { getPerson } from "@/lib/api/people";
import { getEpisodeState, getSeason } from "@/lib/api/show";
import { getFriends } from "@/lib/api/social";
import { getStats } from "@/lib/api/stats";
import { readGroup } from "@/lib/show/group-filter";

/**
 * Starts the reads a page makes on load, with the same arguments, so the page
 * finds them cached or in flight (lib/api/cache.ts). On a nav hover it warms
 * the next page; on arrival it starts reads the page would otherwise only
 * make once its season had loaded. Failures surface when the page asks itself.
 */
export function prefetchPage(href: string, season: string): void {
  const url = new URL(href, "https://dwts.invalid");
  const group = readGroup();
  const start = (...reads: Promise<unknown>[]) => reads.forEach((r) => r.catch(() => {}));
  switch (url.pathname) {
    case "/":
      return start(getOverview(season), getLeaderboard(season, "global", null));
    case "/episode/": {
      const ep = Number(url.searchParams.get("ep"));
      start(getSeason(season), getOverview(season), getMyGroups());
      if (ep > 0) start(getEpisodeState(season, ep, group));
      return;
    }
    case "/leaderboard/": {
      const scope = url.searchParams.get("scope");
      const board = url.searchParams.get("season") === ALL_TIME ? ALL_TIME : season;
      start(getSeason(season), getMyGroups());
      // A group board needs the group list first to pick its group.
      if (scope !== "group") start(getLeaderboard(board, scope === "friends" ? "friends" : "global", null));
      return;
    }
    case "/stats/":
      return start(getSeason(season), getMyGroups(), getStats(season, group));
    case "/couples/":
      start(getSeason(season), getMyGroups());
      if (url.searchParams.get("view") !== "week") start(getPerformers(season, group));
      return;
    case "/couples/couple/":
      return start(getSeason(season), getPerson(url.searchParams.get("id") ?? "", season));
    case "/discover/":
      return start(getSeason(season), getFriends(), getMyGroups());
    case "/groups/":
      return start(getGroupDetails(), getFriends());
    case "/profile/":
      return start(getFriends());
  }
}
