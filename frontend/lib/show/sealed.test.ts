import { beforeEach, describe, expect, it } from "vitest";

import { seal, sealedParam } from "@/lib/show/sealed";

describe("sealedParam", () => {
  beforeEach(() => window.localStorage.clear());

  it("is empty with nothing sealed", () => {
    expect(sealedParam("dwts-35")).toBe("");
  });

  it("lists one season's seals as ep:key, every season's for all", () => {
    seal("dwts-35", 6, "tatyana-ali#1");
    seal("dwts-35", 6, "a+b+c#1");
    seal("dwts-34", 2, "x#1");
    expect(sealedParam("dwts-35")).toBe("6:tatyana-ali#1,6:a+b+c#1");
    expect(sealedParam("all")).toBe("6:tatyana-ali#1,6:a+b+c#1,2:x#1");
    expect(sealedParam("dwts-33")).toBe("");
  });
});
