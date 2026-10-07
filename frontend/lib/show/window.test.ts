import { describe, expect, it } from "vitest";

import { closesIn, closesOn, isClosed } from "./window";

const at = Date.parse("2026-10-07T14:00:00Z");

describe("scoring window", () => {
  it("counts down to the close", () => {
    expect(closesIn("2026-10-14T00:00:00Z", at)).toBe("6d 10h");
    expect(closesIn("2026-10-07T18:05:00Z", at)).toBe("4h 5m");
    expect(closesIn("2026-10-07T14:12:30Z", at)).toBe("12m");
    expect(closesIn("2026-10-07T13:00:00Z", at)).toBe("under a minute");
  });

  it("names the close in the show's zone", () => {
    expect(closesOn("2026-10-14T00:00:00Z", "America/New_York")).toBe("Tue 8:00 PM ET");
  });

  it("is closed only past closesAt, not before it opens", () => {
    const shut = { opensAt: "2026-10-01T00:00:00Z", closesAt: "2026-10-07T00:00:00Z", open: false };
    expect(isClosed(shut, at)).toBe(true);
    expect(isClosed({ ...shut, opensAt: "2026-10-14T00:00:00Z", closesAt: "2026-10-21T00:00:00Z" }, at)).toBe(false);
    expect(isClosed({ ...shut, open: true, closesAt: "2026-10-14T00:00:00Z" }, at)).toBe(false);
    expect(isClosed(undefined, at)).toBe(false);
  });
});
