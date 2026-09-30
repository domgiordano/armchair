import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/show", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/show")>()),
  getEpisodeState: vi.fn(),
}));

import { getEpisodeState, type Episode, type EpisodeState } from "@/lib/api/show";
import { useEpisodeState } from "./use-episode-state";

const EP: Episode = { ep: 6, week: 5, airDate: "2026-10-13", start: "20:00", end: "22:00", theme: null };
const STATE = { ep: 6, performances: [] } as unknown as EpisodeState;
let visibility: DocumentVisibilityState = "visible";

function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
}

const calls = () => vi.mocked(getEpisodeState).mock.calls.length;
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  vi.mocked(getEpisodeState).mockResolvedValue(STATE);
  visibility = "visible";
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(getEpisodeState).mockReset();
});

describe("useEpisodeState", () => {
  it("polls every 10s during the show", async () => {
    vi.setSystemTime(Date.parse("2026-10-14T00:30:00Z"));
    renderHook(() => useEpisodeState("dwts-35", "America/New_York", EP));
    await advance(0);
    expect(calls()).toBe(1);
    await advance(10_000);
    expect(calls()).toBe(2);
  });

  it("polls every 60s outside the show", async () => {
    vi.setSystemTime(Date.parse("2026-10-15T12:00:00Z"));
    renderHook(() => useEpisodeState("dwts-35", "America/New_York", EP));
    await advance(59_000);
    expect(calls()).toBe(1);
    await advance(1_000);
    expect(calls()).toBe(2);
  });

  it("stops while hidden and fetches at once when shown again", async () => {
    vi.setSystemTime(Date.parse("2026-10-14T00:30:00Z"));
    const { result } = renderHook(() => useEpisodeState("dwts-35", "America/New_York", EP));
    await advance(0);
    act(() => setVisibility("hidden"));
    await advance(120_000);
    expect(calls()).toBe(1);

    act(() => setVisibility("visible"));
    await advance(0);
    expect(calls()).toBe(2);
    expect(result.current.data).toBe(STATE);
  });

  it("keeps the last good state when a poll fails", async () => {
    vi.setSystemTime(Date.parse("2026-10-14T00:30:00Z"));
    const { result } = renderHook(() => useEpisodeState("dwts-35", "America/New_York", EP));
    await advance(0);
    vi.mocked(getEpisodeState).mockRejectedValueOnce(new Error("Network down"));
    await advance(10_000);
    expect(result.current).toMatchObject({ data: STATE, error: "Network down" });
  });
});
