import { describe, expect, it } from "vitest";

import type { OpenRow, PerformanceRow, PersonPage, Stint } from "@/lib/api/people";
import { career, coupleTotals, overviewLines, partnership, placeText, type Segment } from "./couple";

const row = (ep: number, panelMean: number | null, mine: OpenRow["mine"], style = "Tango"): OpenRow => ({
  season: "dwts-35",
  ep,
  week: ep - 1,
  key: "a#1",
  style,
  song: null,
  dancers: [],
  locked: false,
  judges: [],
  panelMean,
  mine,
  friends: { count: ep === 2 ? 1 : 3, mean: ep === 2 ? 6 : 8 },
  everyone: { count: 4, mean: 7 },
});
const LOCKED: PerformanceRow = { season: "dwts-35", ep: 5, week: 4, key: "a#1", style: "Jive", song: null, dancers: [], locked: true };

describe("coupleTotals", () => {
  it("averages only what the gate opened, pooling crowds by how many scored", () => {
    const t = coupleTotals([row(2, 7, { value: 9 }), row(3, 8, { value: 6 }), row(4, null, { forfeit: true }), LOCKED]);
    expect(t).toMatchObject({ dances: 4, locked: 1, judges: 7.5, judged: 2, you: 7.5, paddles: 2, gap: 0 });
    expect(t.friends).toEqual({ count: 7, mean: 7.71 });
    expect(t.everyone).toEqual({ count: 12, mean: 7 });
  });

  it("picks the judges' best and lowest, your favorite and the widest split", () => {
    const t = coupleTotals([row(2, 7, { value: 9 }, "Cha-cha"), row(3, 8.5, { value: 8 }, "Waltz"), row(4, 6, { value: 6 }, "Jive")]);
    expect(t.best?.style).toBe("Waltz");
    expect(t.worst?.style).toBe("Jive");
    expect(t.favorite?.style).toBe("Cha-cha");
    expect(t.split?.style).toBe("Cha-cha");
  });

  it("has no lowest with one judged dance, and nothing at all when every dance is gated", () => {
    expect(coupleTotals([row(2, 7, null)]).worst).toBeNull();
    expect(coupleTotals([LOCKED])).toMatchObject({ judges: null, you: null, gap: null, best: null, favorite: null, split: null });
  });
});

const stint = (number: number, partner: string, place?: number, cast = 12): Stint => ({
  season: `dwts-${number}`,
  number,
  role: "pro",
  loaded: false,
  partners: [{ id: partner.toLowerCase().replace(/ /g, "-"), name: partner }],
  result: null,
  ...(place === undefined ? {} : { place, cast }),
});

const person = (id: string, name: string, seasons: Stint[], extra: Partial<PersonPage> = {}): PersonPage => ({
  id,
  name,
  roles: ["pro"],
  headshot: null,
  bio: null,
  facts: null,
  seasons,
  performances: [],
  judged: null,
  stats: { dancer: null, judge: null },
  ...extra,
});

const text = (lines: Segment[][]) => lines.map((l) => l.map((x) => (typeof x === "string" ? x : `[${x.name}]`)).join(""));

describe("placeText", () => {
  it.each([
    [1, "Won the season"],
    [2, "Runner-up"],
    [3, "3rd of 12"],
    [11, "11th of 12"],
  ])("%i of 12 reads %s", (place, want) => {
    expect(placeText(place, 12)).toBe(want);
  });
});

describe("career", () => {
  const pro = person("witney-carson", "Witney Carson", [stint(20, "Riker Lynch", 2), stint(21, "Alek Skarlatos", 3), stint(34, "Robert Irwin", 1, 14), stint(35, "Dylan Efron")]);

  it("counts only the seasons before the one on the page", () => {
    const run = career(pro, "dwts-34");
    expect(run).toMatchObject({ nth: 3, partners: 2, titles: [] });
    expect(run.best?.number).toBe(20);
    expect(career(pro, "dwts-35")).toMatchObject({ nth: 4, partners: 3 });
    expect(career(pro, "dwts-35").titles.map((s) => s.number)).toEqual([34]);
  });

  it("is a debut with nothing before it", () => {
    expect(career(pro, "dwts-20")).toMatchObject({ nth: 1, before: [], partners: 0, titles: [], best: null });
  });
});

describe("partnership", () => {
  it("counts nights and styles from every dance, the top score and 10s only from revealed ones", () => {
    const ten = { ...row(3, 9.5, null, "Argentine tango\n& Cha-cha-cha"), judges: [{ id: "a", value: 10, state: "confirmed" as const }, { id: "b", value: 9, state: "confirmed" as const }] };
    expect(partnership([row(2, 7, null, "Tango"), ten, LOCKED])).toEqual({
      nights: 3,
      styles: ["Tango", "Argentine tango & Cha-cha-cha", "Jive"],
      top: 9.5,
      tens: 1,
    });
    expect(partnership([LOCKED])).toEqual({ nights: 1, styles: ["Jive"], top: null, tens: 0 });
  });
});

describe("overviewLines", () => {
  const celeb = person("robert-irwin", "Robert Irwin", [{ ...stint(34, "Witney Carson"), role: "celebrity" }], {
    bio: { title: "Robert Irwin", url: "", description: "Australian television presenter (born 2003)", extract: "" },
  });
  const pro = person("witney-carson", "Witney Carson", [stint(19, "Alfonso Ribeiro", 1), stint(20, "Riker Lynch", 2), stint(21, "Alek Skarlatos", 3), stint(22, "Von Miller", 9), stint(34, "Robert Irwin")]);

  it("says who the star is and the pro's run, naming people as links", () => {
    const lines = overviewLines(celeb, { id: "witney-carson", name: "Witney Carson", page: pro }, "dwts-34");
    expect(text(lines)).toEqual([
      "[Robert Irwin] is an Australian television presenter.",
      "This is [Witney Carson]'s 5th season as a pro, after partnering [Von Miller], [Alek Skarlatos], [Riker Lynch] and 1 more.",
      "A champion before, with [Alfonso Ribeiro] in Season 19.",
    ]);
  });

  it("names a debut, and leaves the pro out until their page loads", () => {
    const debut = person("new-pro", "New Pro", [stint(34, "Robert Irwin")]);
    expect(text(overviewLines(celeb, { id: "new-pro", name: "New Pro", page: debut }, "dwts-34"))[1]).toBe("This is [New Pro]'s first season as a pro.");
    expect(overviewLines(celeb, { id: "new-pro", name: "New Pro", page: null }, "dwts-34")).toHaveLength(1);
  });

  it("brings back a returning star's last season", () => {
    const allStar = person("kelly-monaco", "Kelly Monaco", [
      { ...stint(1, "Alec Mazo", 1, 6), role: "celebrity" },
      { ...stint(15, "Valentin Chmerkovskiy"), role: "celebrity" },
    ]);
    expect(text(overviewLines(allStar, { id: "x", name: "X", page: null }, "dwts-15"))).toEqual([
      "Back on the floor after dancing with [Alec Mazo] in Season 1 and winning it.",
    ]);
  });
});
