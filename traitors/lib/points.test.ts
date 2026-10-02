import { describe, expect, it } from "vitest";

import type { EpisodeEvent } from "@/lib/api/traitors";

import { eventPoints, ranks, roundTable } from "./points";

// The cases in backend/tests/test_points.py, so the two scorers can't drift.
// US season 4, episode 9: Stephen 5, Johnny 2, Tara 2.
const RT = { banished: "stephen", firstVote: { stephen: 5, johnny: 2, tara: 2 } };

describe("points", () => {
  it("lets tied counts share their ranks", () => {
    expect(ranks(RT.firstVote)).toEqual({ stephen: [1, 1], johnny: [2, 3], tara: [2, 3] });
  });

  it.each([
    [["stephen", "johnny", "tara"], 5 + 3 + 2],
    [["stephen", "tara", "johnny"], 10],
    [["johnny", "stephen", "tara"], 1 + 1 + 2],
    [["eric", "rob", "mark"], 0],
    [["stephen", "eric", "johnny"], 5 + 0 + 2],
  ])("scores the round table %j as %i", (picks, points) => {
    expect(roundTable(picks, RT)).toBe(points);
  });

  it("scores slot 1 against who left, even when Fate chose", () => {
    // UK series 4, episode 5: Amanda and Reece tied 5-5, then Fate took Amanda.
    const result = { banished: "amanda", firstVote: { amanda: 5, reece: 5, stephen: 3, x: 1 } };
    expect(roundTable(["amanda", "reece", "stephen"], result)).toBe(10);
    expect(roundTable(["reece", "amanda", "stephen"], result)).toBe(6);
  });

  const night = (type: "MURDER" | "RECRUIT", pick: string, result: Record<string, string[]> | null): EpisodeEvent =>
    ({ type, picks: 1, locked: false, mine: { picks: [pick], submittedAt: "" }, result }) as EpisodeEvent;

  it("scores nights, and voids a night without one", () => {
    expect(eventPoints(night("MURDER", "dan", { victims: ["dan", "eve"] }))).toBe(4);
    expect(eventPoints(night("MURDER", "dan", { victims: [] }))).toBe(0);
    expect(eventPoints(night("RECRUIT", "katie", { recruits: ["katie"] }))).toBe(4);
    expect(eventPoints(night("RECRUIT", "katie", {}))).toBe(0);
  });

  it("has nothing to score before the result or after a forfeit", () => {
    expect(eventPoints(night("MURDER", "dan", null))).toBeNull();
    const forfeit = { ...night("MURDER", "dan", { victims: ["dan"] }), mine: { forfeit: true, submittedAt: "" } };
    expect(eventPoints(forfeit)).toBeNull();
  });
});
