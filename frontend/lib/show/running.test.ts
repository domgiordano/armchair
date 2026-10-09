import { describe, expect, it } from "vitest";

import type { Card, Contestant } from "@/lib/api/show";
import { cues, findCards } from "@/lib/show/running";

const card = (key: string): Card => ({
  key,
  contestants: key.slice(0, key.lastIndexOf("#")).split("+"),
  n: 1,
  style: null,
  song: null,
  locked: true,
});
const cards = ["amber-glenn#1", "tyler-cameron#1", "julia-stiles#1"].map(card);

describe("cues", () => {
  it("puts the first dance up first before anything is scored", () => {
    expect([...cues(cards, 0)]).toEqual([["amber-glenn#1", "first"]]);
  });

  it("follows the judges: the first unscored is on now, the next up next", () => {
    expect([...cues(cards, 1)]).toEqual([
      ["tyler-cameron#1", "on"],
      ["julia-stiles#1", "next"],
    ]);
    expect([...cues(cards, 2)]).toEqual([["julia-stiles#1", "on"]]);
    expect(cues(cards, 3).size).toBe(0);
  });
});

describe("findCards", () => {
  const person = (name: string, role: "celebrity" | "pro") => ({ name, role, headshot: null });
  const couple = (id: string, celeb: string, pro: string): Contestant => ({
    id,
    keyword: celeb,
    members: [person(celeb, "celebrity"), person(pro, "pro")],
  });
  const contestants = new Map(
    [
      couple("amber-glenn", "Amber Glenn", "Pasha Pashkov"),
      couple("tyler-cameron", "Tyler Cameron", "Sharna Burgess"),
      couple("julia-stiles", "Julia Stiles", "Ezra Sosa"),
    ].map((c) => [c.id, c]),
  );
  const keys = (q: string) => findCards(cards, q, contestants).map((c) => c.key);

  it("finds a couple by celebrity or pro, a first name, or a typo", () => {
    expect(keys("tyler")).toEqual(["tyler-cameron#1"]);
    expect(keys("sharna")).toEqual(["tyler-cameron#1"]);
    expect(keys("ezra sosa")).toEqual(["julia-stiles#1"]);
    expect(keys("pashkof")).toEqual(["amber-glenn#1"]);
  });

  it("keeps every card for an empty query and none for a stranger", () => {
    expect(keys("  ")).toHaveLength(3);
    expect(keys("zendaya")).toEqual([]);
  });

  it("finds anyone in a team dance", () => {
    const team = card("amber-glenn+julia-stiles#1");
    expect(findCards([team], "julia", contestants)).toEqual([team]);
  });
});
