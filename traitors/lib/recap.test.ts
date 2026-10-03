import { expect, it } from "vitest";

import { excerpt, votesByTarget } from "./recap";

it("keeps a short recap whole and cuts a long one at a word", () => {
  expect(excerpt("Ben was banished.", 40)).toBe("Ben was banished.");
  expect(excerpt("The Faithful turned on Ben, and the castle went quiet.", 30)).toBe("The Faithful turned on Ben…");
  expect(excerpt("Two\n\nparagraphs here", 40)).toBe("Two paragraphs here");
});

it("groups the round table's ballots by target, most votes first", () => {
  expect(votesByTarget({ ava: "ben", cal: "ben", ben: "cal", dee: "ava", eli: "ben" })).toEqual([
    { target: "ben", voters: ["ava", "cal", "eli"] },
    { target: "ava", voters: ["dee"] },
    { target: "cal", voters: ["ben"] },
  ]);
});
