import { describe, expect, it } from "vitest";

import { withSeason } from "./seasons";

describe("withSeason", () => {
  it("leaves the current season off", () => {
    expect(withSeason("/stats/", "dwts-35")).toBe("/stats/");
    expect(withSeason("/stats/?season=dwts-34", "dwts-35")).toBe("/stats/");
  });

  it("adds a past season beside the other params", () => {
    expect(withSeason("/episode/?ep=3", "dwts-34")).toBe("/episode/?ep=3&season=dwts-34");
    expect(withSeason("/", "dwts-1")).toBe("/?season=dwts-1");
  });
});
