import { expect, it } from "vitest";

import { extremes, rate } from "./crowd";

const EPISODES = [
  { ep: 1, title: null, calls: { RT: { voters: 4, hits: 0 }, MURDER: { voters: 4, hits: 4 } } },
  { ep: 2, title: null, calls: { RT: { voters: 1, hits: 0 }, RECRUIT: { voters: 3, hits: 2 } } },
];

it("ranks calls by crowd hit rate, more voters first on a tie, none in both lists", () => {
  const { hardest, easiest } = extremes(EPISODES, 2);
  expect(hardest.map((c) => [c.ep, c.type])).toEqual([
    [1, "RT"],
    [2, "RT"],
  ]);
  expect(easiest.map((c) => [c.ep, c.type, c.rate])).toEqual([
    [1, "MURDER", 1],
    [2, "RECRUIT", 2 / 3],
  ]);
});

it("splits a short season's calls between the lists", () => {
  const { hardest, easiest } = extremes([EPISODES[0]]);
  expect([hardest.map((c) => c.type), easiest.map((c) => c.type)]).toEqual([["RT"], ["MURDER"]]);
});

it("has no rate before anyone called it", () => {
  expect(rate(0, 0)).toBeNull();
  expect(rate(1, 4)).toBe(0.25);
});
