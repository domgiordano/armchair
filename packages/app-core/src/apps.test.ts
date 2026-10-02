import { describe, expect, it } from "vitest";

import { APPS, appLink } from "./apps";

describe("appLink", () => {
  it("opens another site signed in", () => {
    expect(appLink("traitors", "/episodes/", { season: "tus-5" })).toBe(
      "https://traitors.armchairjudge.com/episodes/?season=tus-5&sso=1",
    );
  });

  it("has nothing for a show that isn't live", () => {
    expect(appLink("survivor")).toBeNull();
    expect(APPS.map((a) => a.id)).toEqual(["hub", "dwts", "traitors", "survivor"]);
  });
});
