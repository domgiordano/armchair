import { describe, expect, it } from "vitest";

import { distance, EXACT, fold, FUZZY, INSIDE, PREFIX, rank, search, WORD } from "./match";

describe("fold", () => {
  it("drops case, accents and apostrophes and squeezes spaces", () => {
    expect(fold("  Daniella   Karagach ")).toBe("daniella karagach");
    expect(fold("Iveta Śliwińska")).toBe("iveta sliwinska");
    expect(fold("Shaquille O'Neal")).toBe("shaquille oneal");
  });
});

describe("distance", () => {
  it("counts an edit or a swap of neighbours as one", () => {
    expect(distance("derek", "derek")).toBe(0);
    expect(distance("derk", "derek")).toBe(1);
    expect(distance("dreek", "derek")).toBe(1);
    expect(distance("drek", "dere")).toBe(2);
  });
});

describe("rank", () => {
  it("orders exact, prefix, word prefix, inside, then one typo", () => {
    expect(rank("Derek Hough", "derek hough")).toBe(EXACT);
    expect(rank("Derek Hough", "derek h")).toBe(PREFIX);
    expect(rank("Derek Hough", "hough der")).toBe(WORD);
    expect(rank("Derek Hough", "ek ho")).toBe(INSIDE);
    expect(rank("Derek Hough", "derk hough")).toBe(FUZZY);
    expect(rank("Derek Hough", "hoguh")).toBe(FUZZY);
  });

  it("matches accented names typed without accents", () => {
    expect(rank("Iveta Śliwińska", "sliw")).toBe(WORD);
  });

  it("lets a typo through only in words of four letters or more", () => {
    expect(rank("Derek Hough", "dre")).toBeNull();
    expect(rank("Derek Hough", "drek")).toBe(FUZZY);
    expect(rank("Witney Carson", "witny")).toBe(FUZZY);
    expect(rank("Derek Hough", "derek smith")).toBeNull();
  });
});

describe("search", () => {
  it("ranks best first and keeps the given order on ties", () => {
    const names = ["Julianne Hough", "Derek Hough", "Hough Smith", "Mark Ballas"];
    expect(search(names, "hough", (n) => n, 10)).toEqual(["Hough Smith", "Julianne Hough", "Derek Hough"]);
    expect(search(names, "hough", (n) => n, 1)).toEqual(["Hough Smith"]);
    expect(search(names, "  ", (n) => n, 10)).toEqual([]);
  });
});
