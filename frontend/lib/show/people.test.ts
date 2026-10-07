import { describe, expect, it } from "vitest";

import { guestLabel } from "./people";

describe("guestLabel", () => {
  it.each([
    [[], "Guest judge"],
    [[5], "Guest judge, week 5"],
    [[5, 7], "Guest judge, weeks 5 and 7"],
    [[2, 5, 7], "Guest judge, weeks 2, 5 and 7"],
  ])("%j reads %s", (weeks, want) => {
    expect(guestLabel(weeks)).toBe(want);
  });
});
