import { describe, expect, it } from "vitest";

import { pollInterval } from "./poll";

describe("pollInterval", () => {
  it.each([
    [true, true, 10_000],
    [true, false, 60_000],
    [false, true, null],
    [false, false, null],
  ])("visible=%s live=%s -> %s", (visible, live, expected) => {
    expect(pollInterval(visible, live)).toBe(expected);
  });
});
