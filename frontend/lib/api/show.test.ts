import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAuthSession } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
  return { fetchAuthSession: vi.fn() };
});
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession }));

import { submitScore, type LockedCard } from "./show";

const card = (key: string, contestants: string[]): LockedCard => ({
  key,
  contestants,
  n: Number(key.slice(key.lastIndexOf("#") + 1)),
  style: null,
  song: null,
  locked: true,
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "id-token", payload: { sub: "u1" } } } });
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: {}, error: null, meta: null })));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const sent = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe("submitScore", () => {
  it("sends a couple's id and dance number", async () => {
    await submitScore("dwts-35", 5, card("amber-glenn#2", ["amber-glenn"]), { value: 8 });
    expect(sent()).toEqual({ season: "dwts-35", ep: "05", contestant: "amber-glenn", n: 2, value: 8 });
  });

  it("sends a team dance as every member couple, the way its key names them", async () => {
    await submitScore("dwts-34", 8, card("a-b+c-d+e-f#1", ["a-b", "c-d", "e-f"]), { forfeit: true });
    expect(sent()).toEqual({ season: "dwts-34", ep: "08", contestant: "a-b+c-d+e-f", n: 1, forfeit: true });
  });
});
