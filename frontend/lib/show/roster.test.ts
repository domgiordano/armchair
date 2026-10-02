import { describe, expect, it } from "vitest";

import type { Member } from "@/lib/api/show";
import { rosterOrder, scoreLine, type RosterCouple } from "./roster";

const couple = (name: string, judges: number | null, you: number | null, out: number | null = null): RosterCouple => ({
  id: name.toLowerCase(),
  members: [{ name, role: "celebrity", headshot: null } as Member],
  eliminated: out === null ? null : { ep: out, week: out - 1 },
  judges,
  judged: judges === null ? 0 : 1,
  you,
  gap: null,
});

const names = (cs: RosterCouple[]) => cs.map((c) => c.members[0].name);
const CAST = [couple("Cara", 7, null), couple("Abe", null, 6), couple("Bo", 8, 9), couple("Dee", 9, 4, 3), couple("Eve", 6, 8, 5), couple("Al", null, null)];

describe("rosterOrder", () => {
  it("ranks those still dancing, couples without a number last by name, then the most recently eliminated first", () => {
    expect(names(rosterOrder(CAST, "judges", true))).toEqual(["Bo", "Cara", "Abe", "Al", "Eve", "Dee"]);
    expect(names(rosterOrder(CAST, "you", true))).toEqual(["Bo", "Abe", "Al", "Cara", "Eve", "Dee"]);
    expect(names(rosterOrder(CAST, "name", true))).toEqual(["Abe", "Al", "Bo", "Cara", "Eve", "Dee"]);
  });

  it("drops the eliminated when they're hidden", () => {
    expect(names(rosterOrder(CAST, "judges", false))).toEqual(["Bo", "Cara", "Abe", "Al"]);
  });
});

describe("scoreLine", () => {
  const season = { open: false } as Parameters<typeof scoreLine>[1];
  it("says what the caller can see, or why not", () => {
    expect(scoreLine(couple("Bo", 8, 9), season, true)).toBe("Judges 8.0 · You 9.0");
    expect(scoreLine(couple("Al", null, null), season, true)).toBe("Score to see the judges' marks");
    expect(scoreLine(couple("Al", null, null), season, false)).toBe("No dances yet");
    expect(scoreLine(couple("Al", null, null), { ...season, open: true }, true)).toBe("No judges' scores on record");
  });
});
