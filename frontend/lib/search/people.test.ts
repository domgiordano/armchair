import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@armchair/app-core/api/social", () => ({ getFriends: vi.fn(), searchPeople: vi.fn() }));

import { searchPeople, type Match } from "@armchair/app-core/api/social";

import { forgetMembers, knownMembers, searchMembers } from "./people";

const member = (sub: string, name: string): Match => ({ sub, name, picture: null, avatarKind: "initials", status: null });

afterEach(() => {
  vi.useRealTimers();
  forgetMembers();
});

describe("member search memory", () => {
  it("narrows a complete list locally, then forgets it after a minute", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.mocked(searchPeople).mockResolvedValue([member("a", "Derek Fan"), member("b", "Dee Lee")]);
    await searchMembers("de");
    expect(knownMembers("der")?.map((m) => m.name)).toEqual(["Derek Fan"]);
    vi.advanceTimersByTime(61_000);
    expect(knownMembers("der")).toBeUndefined();
  });

  it("asks again when the shorter list was cut off at the server's limit", async () => {
    const full = Array.from({ length: 20 }, (_, i) => member(`s${i}`, `Dee ${i}`));
    vi.mocked(searchPeople).mockResolvedValue(full);
    await searchMembers("de");
    expect(knownMembers("dee 1")).toBeUndefined();
  });
});
