import { afterEach, describe, expect, it } from "vitest";

import { airTime, readVotes, smsHref, voteWindow, writeVotes, type AirEpisode } from "./voting";

const ET = "America/New_York";
const ep = (n: number, airDate: string): AirEpisode => ({ ep: n, airDate, start: "20:00", end: "22:00" });
const EPISODES = [ep(5, "2026-10-06"), ep(6, "2026-10-13"), ep(9, "2026-11-02"), ep(12, "2026-11-24")];

const at = (iso: string) => voteWindow(EPISODES, ET, new Date(iso));

describe("voteWindow", () => {
  it("opens at 8:00 pm ET on Tue 10/13 (EDT) and closes at the catalog's end time", () => {
    expect(at("2026-10-13T19:59:00-04:00")).toEqual({ open: false, next: EPISODES[1] });
    expect(at("2026-10-13T20:00:00-04:00")).toEqual({ open: true, episode: EPISODES[1] });
    expect(at("2026-10-13T21:59:00-04:00")).toEqual({ open: true, episode: EPISODES[1] });
    expect(at("2026-10-13T22:00:00-04:00")).toEqual({ open: false, next: EPISODES[2] });
  });

  it("follows the clock change for Mon 11/2 (EST)", () => {
    // 8:30 pm EDT would be 00:30Z; after the 11/1 change 8:30 pm ET is 01:30Z.
    expect(at("2026-11-03T00:30:00Z")).toEqual({ open: false, next: EPISODES[2] });
    expect(at("2026-11-03T01:30:00Z")).toEqual({ open: true, episode: EPISODES[2] });
    expect(at("2026-11-03T03:00:00Z")).toEqual({ open: false, next: EPISODES[3] });
  });

  it("is closed on a non-air day and after the finale", () => {
    expect(at("2026-10-14T20:30:00-04:00")).toEqual({ open: false, next: EPISODES[2] });
    expect(at("2026-11-24T22:05:00-05:00")).toEqual({ open: false, next: null });
  });

  describe("on a Pacific-time device", () => {
    const original = process.env.TZ;
    afterEach(() => {
      process.env.TZ = original;
    });

    it("is open during the live East Coast broadcast and closed for the local airing", () => {
      process.env.TZ = "America/Los_Angeles";
      expect(new Date(2026, 9, 13, 17, 30).getTimezoneOffset()).toBe(420);

      expect(voteWindow(EPISODES, ET, new Date(2026, 9, 13, 17, 30))).toEqual({ open: true, episode: EPISODES[1] });
      expect(voteWindow(EPISODES, ET, new Date(2026, 9, 13, 20, 30))).toEqual({ open: false, next: EPISODES[2] });
    });
  });
});

describe("airTime", () => {
  it("formats the catalog's air-zone date and start", () => {
    expect(airTime(EPISODES[1])).toBe("Tue, Oct 13 at 8:00 pm");
    expect(airTime(EPISODES[2])).toBe("Mon, Nov 2 at 8:00 pm");
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
