import { describe, expect, it } from "vitest";

import type { GroupDetail, GroupPerson } from "@armchair/app-core/api/groups";
import type { Leaderboard } from "@/lib/api/leaderboard";
import { inviteCode, joins, possessive, weekProgress } from "@/lib/social/group-summary";

const m = (sub: string, joinedAt: string | null = null): GroupPerson => ({
  sub,
  name: sub,
  picture: null,
  avatarKind: null,
  relation: null,
  joinedAt,
});
const group = {
  members: [m("a", "2026-09-20T12:00:00Z"), m("b", "2026-10-12T23:40:00Z"), m("c"), m("d", "2026-10-01T00:00:00Z")],
} as GroupDetail;

describe("weekProgress", () => {
  it("splits members into done, started and waiting", () => {
    const board = { week: { ep: 6, week: 5, rateable: 11, answered: { a: 11, b: 4, c: 0 } } } as unknown as Leaderboard;
    const p = weekProgress(group, board);
    expect(p?.done.map((x) => x.sub)).toEqual(["a"]);
    expect(p?.started.map((x) => x.sub)).toEqual(["b"]);
    expect(p?.waiting.map((x) => x.sub)).toEqual(["c", "d"]);
  });

  it("is null without a week, or a week with nothing to score", () => {
    expect(weekProgress(group, {} as Leaderboard)).toBeNull();
    expect(
      weekProgress(group, { week: { ep: 1, week: 1, rateable: 0, answered: {} } } as unknown as Leaderboard),
    ).toBeNull();
  });
});

describe("joins", () => {
  it("lists newest first and skips members with no date", () => {
    expect(joins(group).map((j) => j.member.sub)).toEqual(["b", "d", "a"]);
  });
});

describe("possessive", () => {
  it("drops the s after a trailing s", () => {
    expect(possessive("Couch Judges")).toBe("Couch Judges'");
    expect(possessive("Office Pool")).toBe("Office Pool's");
  });
});

describe("inviteCode", () => {
  const code = "AbCdEfGh_jKl-123";
  it("reads a bare code, a join link or a preview link", () => {
    expect(inviteCode(` ${code} `)).toBe(code);
    expect(inviteCode(`https://dwts.armchairjudge.com/join/?code=${code}`)).toBe(code);
    expect(inviteCode(`https://api.dwts.armchairjudge.com/invite/preview?code=${code}`)).toBe(code);
  });

  it("refuses anything else", () => {
    expect(inviteCode("hello")).toBeNull();
    expect(inviteCode("https://example.com/?code=short")).toBeNull();
  });
});
