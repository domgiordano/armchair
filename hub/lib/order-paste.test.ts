import { expect, it } from "vitest";

import type { LineupDance } from "@/lib/api/admin";
import { fromPaste } from "@/lib/order-paste";

const dance = (key: string, ...names: string[]): LineupDance => ({ key, names, style: null, song: null, order: null });
const DANCES = [
  dance("amber-glenn#1", "Amber Glenn"),
  dance("ciara-miller#1", "Ciara Miller"),
  dance("ezra-frech#1", "Ezra Frech"),
  dance("harry-shum-jr#1", "Harry Shum Jr."),
  dance("amber-glenn+ezra-frech#1", "Amber Glenn", "Ezra Frech"),
];

it("orders the night by the names pasted, one dance a line", () => {
  const text = "1. Ciara & Brandon – Jazz\n2) Harry and Jenna\n\nEzra & Daniella\n";
  expect(fromPaste(text, DANCES)).toEqual({
    keys: ["ciara-miller#1", "harry-shum-jr#1", "ezra-frech#1", "amber-glenn#1", "amber-glenn+ezra-frech#1"],
    unmatched: [],
  });
});

it("reports a line that names nobody and keeps every dance", () => {
  const out = fromPaste("Glenn\nZendaya & Val\nAmber", DANCES);
  expect(out.unmatched).toEqual(["Zendaya & Val"]);
  // The second Amber line takes the team dance, since her own is already placed.
  expect(out.keys.slice(0, 2)).toEqual(["amber-glenn#1", "amber-glenn+ezra-frech#1"]);
  expect(out.keys).toHaveLength(5);
});
