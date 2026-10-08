import { describe, expect, it } from "vitest";

import { plays, type Group } from "../api/groups";
import { showName, showRows } from "./group-shows";

const group: Group = {
  id: "g1",
  name: "Family",
  inviteCode: "c",
  members: [],
  shows: [
    { app: "dwts", active: true, by: "a", at: "2026-10-01T00:00:00Z", playing: ["a", "b"] },
    { app: "traitors", active: false, by: null, at: null, playing: ["b"] },
  ],
};

describe("showRows", () => {
  it("gives each show its state, players and links", () => {
    const [dwts, traitors] = showRows(group, "a");
    expect(dwts).toMatchObject({ app: "dwts", name: "Dancing with the Stars", active: true, playing: 2, youPlay: true });
    expect(traitors).toMatchObject({ app: "traitors", active: false, playing: 1, youPlay: false });
    expect(traitors.groupHref).toBe("https://traitors.armchairjudge.com/groups/?id=g1&sso=1");
    expect(traitors.homeHref).toBe("https://traitors.armchairjudge.com/?sso=1");
  });
});

describe("plays", () => {
  it("reads the group's shows, and treats an older API as playing everything", () => {
    expect(plays(group, "dwts")).toBe(true);
    expect(plays(group, "traitors")).toBe(false);
    expect(plays({}, "traitors")).toBe(true);
  });
});

describe("showName", () => {
  it("names an app, or says a show", () => {
    expect(showName("traitors")).toBe("The Traitors");
    expect(showName(null)).toBe("a show");
  });
});
