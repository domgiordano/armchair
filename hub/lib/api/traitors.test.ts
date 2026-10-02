import { describe, expect, it, vi } from "vitest";

import { calls, stubApi, traitorsStats } from "@/components/account/test-api";

import { currentSeasons, getCurrentPoints, getRanks, seasonLabel } from "./traitors";

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

  it("gets points for every current season", async () => {
    const fetchMock = stubApi({
      "/traitors/stats": (_, __, url) => ({ data: traitorsStats(url.searchParams.get("season") === "tus-5" ? 12 : 7) }),
    });
    const rows = await getCurrentPoints();
    expect(rows.map((r) => [r.season.id, r.points])).toEqual([
      ["tus-5", 12],
      ["tukc-2", 7],
    ]);
    expect(calls(fetchMock, "/traitors/stats").map(([u]) => params(u).get("season"))).toEqual(["tus-5", "tukc-2"]);
  });

  it("leaves out a season the API won't show, and still fails on anything else", async () => {
    stubApi({
      "/traitors/stats": (_, __, url) => (url.searchParams.get("season") === "tus-5" ? { status: 403 } : { data: traitorsStats(7) }),
    });
    expect((await getCurrentPoints()).map((r) => r.season.id)).toEqual(["tukc-2"]);

    stubApi({ "/traitors/stats": () => ({ status: 500 }) });
    await expect(getCurrentPoints()).rejects.toThrow("Nope");
  });
});
