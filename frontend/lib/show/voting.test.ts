import { afterEach, describe, expect, it } from "vitest";

import type { Episode } from "@/lib/api/show";
import { clockTime, readVotes, smsHref, votePhase, writeVotes } from "./voting";

const ET = "America/New_York";
const ep = (n: number, airDate: string): Episode => ({
  ep: n,
  week: n,
  airDate,
  start: "20:00",
  end: "22:00",
  theme: null,
});
const TUE = ep(6, "2026-10-13");
const MON = ep(9, "2026-11-02");

const at = (e: Episode, iso: string) => votePhase(e, ET, new Date(iso).getTime());

describe("votePhase", () => {
  it("opens at 8:00 pm ET on Tue 10/13 (EDT) and closes at the catalog's end time", () => {
    expect(at(TUE, "2026-10-13T00:00:00-04:00")).toBe("before");
    expect(at(TUE, "2026-10-13T19:59:00-04:00")).toBe("before");
    expect(at(TUE, "2026-10-13T20:00:00-04:00")).toBe("open");
    expect(at(TUE, "2026-10-13T21:59:00-04:00")).toBe("open");
    expect(at(TUE, "2026-10-13T22:00:00-04:00")).toBe("closed");
    expect(at(TUE, "2026-10-13T23:59:00-04:00")).toBe("closed");
  });

  it("is null on any other day", () => {
    expect(at(TUE, "2026-10-12T23:59:00-04:00")).toBeNull();
    expect(at(TUE, "2026-10-14T00:00:00-04:00")).toBeNull();
    expect(at(TUE, "2026-10-14T20:30:00-04:00")).toBeNull();
  });

  it("follows the clock change for Mon 11/2 (EST)", () => {
    // 8:30 pm EDT would be 00:30Z; after the 11/1 change 8:30 pm ET is 01:30Z.
    expect(at(MON, "2026-11-03T00:30:00Z")).toBe("before");
    expect(at(MON, "2026-11-03T01:30:00Z")).toBe("open");
    expect(at(MON, "2026-11-03T03:00:00Z")).toBe("closed");
  });

  describe("on a Pacific-time device", () => {
    const original = process.env.TZ;
    afterEach(() => {
      process.env.TZ = original;
    });

    it("is open during the live East Coast broadcast and closed for the local airing", () => {
      process.env.TZ = "America/Los_Angeles";
      expect(new Date(2026, 9, 13, 17, 30).getTimezoneOffset()).toBe(420);

      expect(votePhase(TUE, ET, new Date(2026, 9, 13, 17, 30).getTime())).toBe("open");
      expect(votePhase(TUE, ET, new Date(2026, 9, 13, 20, 30).getTime())).toBe("closed");
      expect(votePhase(TUE, ET, new Date(2026, 9, 13, 21, 30).getTime())).toBeNull();
    });
  });
});

describe("clockTime", () => {
  it("formats the catalog's 24-hour times", () => {
    expect(clockTime("20:00")).toBe("8:00 pm");
    expect(clockTime("00:05")).toBe("12:05 am");
    expect(clockTime("12:30")).toBe("12:30 pm");
  });
});

describe("smsHref", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
  const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari";
  const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari";

  it("uses & for Apple Messages and ? for Android, with the keyword encoded", () => {
    expect(smsHref("Julia", IPHONE)).toBe("sms:21523&body=Julia");
    expect(smsHref("Connor W", IPAD)).toBe("sms:21523&body=Connor%20W");
    expect(smsHref("Connor W", ANDROID)).toBe("sms:21523?body=Connor%20W");
  });
});

describe("vote tally storage", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("keeps each episode's tally apart, so a new episode starts at 0", () => {
    writeVotes(6, { "julia-stiles": 3 });
    expect(readVotes(6)).toEqual({ "julia-stiles": 3 });
    expect(readVotes(7)).toEqual({});
  });

  it("reads corrupt storage as empty", () => {
    localStorage.setItem("armchair:votes:6", "{not json");
    expect(readVotes(6)).toEqual({});
  });

  it("survives storage that throws", () => {
    const proto = Object.getPrototypeOf(localStorage) as Storage;
    const { getItem, setItem } = proto;
    proto.getItem = () => {
      throw new DOMException("denied", "SecurityError");
    };
    proto.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    try {
      expect(() => writeVotes(6, { a: 1 })).not.toThrow();
      expect(readVotes(6)).toEqual({});
    } finally {
      proto.getItem = getItem;
      proto.setItem = setItem;
    }
  });
});

describe("votePhase on an untimed past-season episode", () => {
  it("is null: there is no vote to show", () => {
    const past: Episode = { ep: 1, week: 1, airDate: "2025-09-16", start: null, end: null, theme: null };
    expect(votePhase(past, ET, new Date("2025-09-16T20:30:00-04:00").getTime())).toBeNull();
  });
});
