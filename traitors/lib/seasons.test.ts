import { describe, expect, it } from "vitest";

import { editionOf, isSeasonId, mergeSeasons, pickSeason, seasonLabel, withSeason } from "./seasons";

const s = (id: string, year: number, current = false) => ({ id, number: Number(id.split("-")[1]), year, current });

describe("seasons", () => {
  it("reads the edition from the show slug", () => {
    expect(editionOf("tus-5")).toBe("us");
    expect(editionOf("tuk-4")).toBe("uk");
    expect(editionOf("tukc-2")).toBe("uk");
  });

  it("accepts only Traitors season ids", () => {
    expect(isSeasonId("tukc-2")).toBe(true);
    expect(isSeasonId("dwts-35")).toBe(false);
    expect(isSeasonId("tus-")).toBe(false);
    expect(isSeasonId(null)).toBe(false);
  });

  it("names seasons per edition, preferring a title", () => {
    expect(seasonLabel(s("tus-4", 2026))).toBe("Season 4");
    expect(seasonLabel(s("tuk-3", 2025))).toBe("Series 3");
    expect(seasonLabel(s("tukc-2", 2026))).toBe("Celebrity 2");
    expect(seasonLabel({ ...s("tus-5", 2026), title: "New Blood" })).toBe("New Blood");
  });

  it("puts live seasons first, then the newest, across both UK series", () => {
    const merged = mergeSeasons([[s("tukc-1", 2025), s("tukc-2", 2026, true)], [s("tuk-4", 2026), s("tuk-3", 2025)]]);
    expect(merged.map((x) => x.id)).toEqual(["tukc-2", "tuk-4", "tuk-3", "tukc-1"]);
  });

  it("keeps the URL's season, else takes the live one", () => {
    const list = mergeSeasons([[s("tus-4", 2026), s("tus-5", 2026, true)]]);
    expect(pickSeason("tus-3", list)).toBe("tus-3");
    expect(pickSeason("bogus", list)).toBe("tus-5");
    expect(pickSeason(null, [])).toBeNull();
  });

  it("adds the season to a link and keeps its query", () => {
    expect(withSeason("/episode/?ep=5", "tus-5")).toBe("/episode/?ep=5&season=tus-5");
    expect(withSeason("/stats/?season=tus-4", "tukc-2")).toBe("/stats/?season=tukc-2");
  });
});
