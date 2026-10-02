import { describe, expect, it, vi } from "vitest";

import { calls, stubApi, traitorsStats } from "@/components/account/test-api";

import { currentSeasons, getRanks, getSeasonCards, seasonLabel } from "./traitors";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: async () => ({ tokens: { idToken: { toString: () => "id-token" } } }),
}));

const params = (url: string) => new URL(url, "http://api.test").searchParams;

describe("traitors api", () => {
  it("lists only the current seasons, tagged with their edition", async () => {
    stubApi();
    const seasons = await currentSeasons(["tus", "tuk", "tukc"]);
    expect(seasons.map((s) => [s.id, s.show])).toEqual([
      ["tus-5", "tus"],
      ["tukc-2", "tukc"],
    ]);
    expect(seasonLabel(seasons[1])).toBe("Celebrity UK · Season 2");
  });

  it("asks for ranks by season, edition and scope, and counts everyone from meta", async () => {
    const fetchMock = stubApi({
      "/traitors/ranks": () => ({ data: { ranked: [{ sub: "u-1" }], me: { sub: "me-1", rank: 140 } }, meta: { ranked: 140 } }),
    });
    const ranks = await getRanks("all", "tuk", "friends");
    expect(ranks.total).toBe(140);
    const url = params(calls(fetchMock, "/traitors/ranks")[0][0]);
    expect([url.get("season"), url.get("show"), url.get("scope")]).toEqual(["all", "tuk", "friends"]);
  });

  it("falls back to the ranked count when meta has none", async () => {
    stubApi({ "/traitors/ranks": () => ({ data: { ranked: [{ sub: "u-1" }, { sub: "u-2" }], me: { sub: "me-1", rank: 2 } } }) });
    expect((await getRanks("tus-5", "tus", "global")).total).toBe(2);
  });

  it("builds a card per current season: points, rank, the bet and the next release", async () => {
    const fetchMock = stubApi({
      "/traitors/stats": (_, __, url) => ({ data: traitorsStats(url.searchParams.get("season") === "tus-5" ? 12 : 7) }),
    });
    const cards = await getSeasonCards();
    expect(cards.map((c) => [c.season.id, c.points, c.rank, c.total, c.needsBet, c.next])).toEqual([
      ["tus-5", 12, 3, 25, false, { ep: 6, releaseAt: "2999-01-15T02:00:00Z" }],
      ["tukc-2", 7, 3, 25, true, null],
    ]);
    expect(calls(fetchMock, "/traitors/season").map(([u]) => params(u).get("season"))).toEqual(["tus-5", "tukc-2"]);
  });

  it("has no rank before the first scored call", async () => {
    stubApi({ "/traitors/stats": () => ({ data: { ...traitorsStats(0), events: 0 } }) });
    expect((await getSeasonCards()).map((c) => c.rank)).toEqual([null, null]);
  });

  it("leaves out a season the API won't show, and still fails on anything else", async () => {
    stubApi({
      "/traitors/stats": (_, __, url) => (url.searchParams.get("season") === "tus-5" ? { status: 403 } : { data: traitorsStats(7) }),
    });
    expect((await getSeasonCards()).map((c) => c.season.id)).toEqual(["tukc-2"]);

    stubApi({ "/traitors/season": () => ({ status: 500 }) });
    await expect(getSeasonCards()).rejects.toThrow("Nope");
  });
});
