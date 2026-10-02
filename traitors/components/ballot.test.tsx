import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getEpisode: vi.fn(), submitPick: vi.fn() }));
vi.mock("@/lib/api/traitors", () => api);
vi.mock("@armchair/app-core/api/client", () => ({ ApiError: class ApiError extends Error {} }));

import type { Episode, EpisodeEvent, SeasonEpisode } from "@/lib/api/traitors";

import { Ballot } from "./ballot";

const ROSTER = ["Ava Stone", "Ben Hart", "Cal Reyes", "Dee Moss", "Eli Park"].map((name) => ({
  id: name.split(" ")[0].toLowerCase(),
  name,
  headshot: null,
}));
const SEASON_EP: SeasonEpisode = { ep: 5, title: null, releaseAt: "2026-10-16T01:00:00Z", closed: false, events: 3, answered: 0 };
const locked = (type: EpisodeEvent["type"]) => ({ type, picks: type === "RT" ? 3 : 1, mine: null, locked: true }) as EpisodeEvent;
const episode = (events: EpisodeEvent[]): Episode => ({
  season: "tus-5",
  ep: 5,
  title: null,
  releaseAt: SEASON_EP.releaseAt,
  closed: false,
  roster: ROSTER,
  out: [],
  needsBet: false,
  events,
});

beforeEach(() => {
  api.getEpisode.mockResolvedValue(episode([locked("MURDER"), locked("RT"), locked("RECRUIT")]));
  api.submitPick.mockResolvedValue({});
});
afterEach(() => vi.clearAllMocks());

const ballot = (onSealed = vi.fn()) =>
  render(<Ballot season="tus-5" episode={SEASON_EP} group={null} members={null} onSealed={onSealed} />);
const seat = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });
const para = (text: string) => (_: string, el: Element | null) => el?.tagName === "P" && el.textContent === text;
const seal = () => screen.getByRole("button", { name: /^Seal/ }) as HTMLButtonElement;

it("shows the table before the winner bet, and asks for the bet instead of taking a pick", async () => {
  api.getEpisode.mockResolvedValue({ ...episode([locked("MURDER"), locked("RT"), locked("RECRUIT")]), needsBet: true });
  const onNeedBet = vi.fn();
  render(<Ballot season="tus-5" episode={SEASON_EP} group={null} members={null} onSealed={vi.fn()} onNeedBet={onNeedBet} />);
  fireEvent.click(await screen.findByRole("button", { name: /^Cal Reyes/ }));
  expect(onNeedBet).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: /^Cal Reyes/ }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.queryByRole("button", { name: /^Seal/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Lock in your winners" }));
  expect(onNeedBet).toHaveBeenCalledTimes(2);
  expect(api.submitPick).not.toHaveBeenCalled();
});

it("ranks three heads at the round table, reorders them on the slate, and seals the slate", async () => {
  const onSealed = vi.fn();
  ballot(onSealed);
  fireEvent.click(await screen.findByRole("tab", { name: "Banish" }));

  fireEvent.click(seat("Cal Reyes"));
  fireEvent.click(seat("Ava Stone"));
  expect(seal().disabled).toBe(true);
  fireEvent.click(seat("Eli Park"));
  expect(seat("Ava Stone").getAttribute("aria-label")).toBe("Ava Stone, your second");
  expect((seat("Ben Hart") as HTMLButtonElement).disabled).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Move Eli Park up" }));
  const slate = within(screen.getByRole("list", { name: "Your slate" }));
  expect(slate.getAllByRole("listitem").map((li) => li.textContent?.match(/Cal|Ava|Eli/)?.[0])).toEqual([
    "Cal",
    "Eli",
    "Ava",
  ]);

  fireEvent.click(seat("Cal Reyes"));
  fireEvent.click(seat("Dee Moss"));
  fireEvent.click(seal());
  await vi.waitFor(() => expect(onSealed).toHaveBeenCalledOnce());
  expect(api.submitPick).toHaveBeenCalledWith("tus-5", 5, "RT", { picks: ["eli", "ava", "dee"] });
  expect(api.getEpisode).toHaveBeenCalledTimes(2);
});

it("opens on the first call still to make, and a single pick swaps on the next tap", async () => {
  ballot();
  expect((await screen.findByRole("tab", { name: "Murder" })).getAttribute("aria-selected")).toBe("true");
  fireEvent.click(seat("Ben Hart"));
  fireEvent.click(seat("Dee Moss"));
  expect(seat("Ben Hart").getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(seal());
  await vi.waitFor(() => expect(api.submitPick).toHaveBeenCalledWith("tus-5", 5, "MURDER", { picks: ["dee"] }));
});

it("seals no pick to see the result", async () => {
  ballot();
  await screen.findByRole("tab", { name: "Murder" });
  fireEvent.click(screen.getByRole("checkbox", { name: "No pick (reveal)" }));
  expect(screen.queryByRole("button", { name: /^Ava Stone/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Seal: no pick" }));
  await vi.waitFor(() => expect(api.submitPick).toHaveBeenCalledWith("tus-5", 5, "MURDER", { forfeit: true }));
});

it("reveals the banishment on the table with your points and everyone's first picks", async () => {
  api.getEpisode.mockResolvedValue(
    episode([
      { type: "MURDER", picks: 1, locked: false, mine: { picks: ["ben"], submittedAt: "" }, result: { victims: ["ben"] } },
      {
        type: "RT",
        picks: 3,
        locked: false,
        mine: { picks: ["ava", "cal", "eli"], submittedAt: "" },
        result: { banished: "ava", faction: "Traitor", firstVote: { ava: 6, cal: 3, eli: 1 } },
        consensus: { voters: 8, picks: { ava: 8 }, first: { ava: 5, cal: 3 } },
      },
      locked("RECRUIT"),
    ]),
  );
  ballot();
  fireEvent.click(await screen.findByRole("tab", { name: "Banish, sealed" }));
  expect(screen.getByRole("link", { name: "Ava Stone, your first, banished, Traitor, 5 called" })).toBeTruthy();
  expect(screen.getByText(para("+10 points"))).toBeTruthy();
  const consensus = within(screen.getByRole("region", { name: /Everyone's calls/ }));
  expect(consensus.getAllByRole("listitem")[0].textContent).toBe("63% had Ava Stone first");
  expect(consensus.getByRole("link", { name: "Ava Stone" }).getAttribute("href")).toMatch(/show=tus&id=ava&season=tus-5/);

  fireEvent.click(screen.getByRole("tab", { name: "Murder, sealed" }));
  expect(screen.getByRole("link", { name: "Ben Hart, your pick, murdered" })).toBeTruthy();
  expect(screen.getByText(para("+4 points"))).toBeTruthy();
});
