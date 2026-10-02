import { expect, it } from "vitest";

import { multiplier } from "./points";
import { firstName, nameOf, roman } from "./players";

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
