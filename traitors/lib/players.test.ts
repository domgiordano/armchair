import { expect, it } from "vitest";

import { multiplier } from "./points";
import { firstName, hideExits, nameOf, roman } from "./players";

it("writes episode numbers as numerals", () => {
  expect([1, 4, 5, 9, 12, 14, 19, 24].map(roman)).toEqual(["I", "IV", "V", "IX", "XII", "XIV", "XIX", "XXIV"]);
});

it("names a player from the roster, else from their slug", () => {
  const roster = [{ id: "rob-rausch", name: "Rob Rausch", headshot: null }];
  expect(nameOf("rob-rausch", roster)).toBe("Rob Rausch");
  expect(nameOf("dylan-efron", roster)).toBe("Dylan Efron");
  expect(firstName("  Rob Rausch ")).toBe("Rob");
});

it("discounts a late winner bet by the share of episodes already out", () => {
  expect(multiplier(12, 0)).toBe(1);
  expect(multiplier(12, 4)).toBeCloseTo(2 / 3);
  expect(multiplier(12, 11)).toBeCloseTo(1 / 12);
  expect(multiplier(0, 0)).toBe(0);
});

it("takes an exit and its side back off the cast while its episode is face down", () => {
  const p = (id: string, ep: number | null) => ({
    id,
    name: id,
    headshot: null,
    faction: ep ? ("Traitor" as const) : null,
    exit: ep ? { ep, how: "banished" } : null,
  });
  const cast = [p("ann", 2), p("bo", 3), p("cy", null)];
  const out = hideExits(cast, (ep) => ep === 3);
  expect(out[0]).toBe(cast[0]);
  expect(out[1]).toMatchObject({ exit: null, faction: null });
  expect(out[2]).toBe(cast[2]);
});
