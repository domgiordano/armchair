import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ path: "/stats/", search: "", push: vi.fn() }));
const traitors = vi.hoisted(() => ({ getTraitorsSeason: vi.fn(), submitWinner: vi.fn() }));
const history = vi.hoisted(() => ({ getHistory: vi.fn(), searchPlayers: vi.fn(), SEARCH_MIN: 2 }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.path,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push, replace: nav.push }),
}));
vi.mock("@armchair/app-core/auth/use-auth", () => ({ useAuth: () => ({ signOut: vi.fn(async () => {}) }) }));
vi.mock("@armchair/app-core/api/client", () => ({
  getMe: vi.fn(async () => ({ sub: "me", email: "me@example.com", name: "Me Myself", picture: null })),
  // The odds board stays loading.
  request: () => new Promise(() => {}),
}));
vi.mock("@/lib/api/traitors", () => traitors);
vi.mock("@/lib/api/history", () => history);
vi.mock("@/lib/api/seasons", () => ({
  getSeasons: vi.fn(async (show: string) =>
    ({
      tus: [
        { id: "tus-5", number: 5, year: 2026, current: true },
        { id: "tus-4", number: 4, year: 2026, current: false },
      ],
      tukc: [{ id: "tukc-2", number: 2, year: 2026, current: true }],
      tuk: [{ id: "tuk-4", number: 4, year: 2026, current: false }],
    })[show],
  ),
}));

// jsdom has <dialog> but not its modal methods.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
  this.open = false;
};

import { AppShell } from "./app-shell";
import { useSeasonId } from "./season-provider";

function Page() {
  return <p>Showing {useSeasonId()}</p>;
}

beforeEach(() => {
  nav.path = "/stats/";
  nav.search = "";
  localStorage.clear();
  traitors.getTraitorsSeason.mockImplementation(async (season: string) => ({
    season,
    title: "",
    current: true,
    needsBet: false,
    bet: null,
    episodes: [],
  }));
});
afterEach(() => vi.clearAllMocks());

const shell = () =>
  render(
    <AppShell title="Stats">
      <Page />
    </AppShell>,
  );

it("opens on the US live season and carries it on every tab", async () => {
  shell();
  expect(await screen.findByText("Showing tus-5")).toBeTruthy();
  const main = screen.getAllByRole("navigation", { name: "Main" })[0];
  expect(within(main).getByRole("link", { name: "Leaderboard" }).getAttribute("href")).toMatch(/^\/leaderboard\/?\?season=tus-5$/);
  expect(within(main).getByRole("link", { name: "Stats" }).getAttribute("aria-current")).toBe("page");
});

it("keeps a season from the URL and lights its edition", async () => {
  nav.search = "season=tukc-2";
  shell();
  expect(await screen.findByText("Showing tukc-2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "United Kingdom edition" }).getAttribute("aria-pressed")).toBe("true");
});

it("switches edition by dropping the old season and remembering the choice", async () => {
  shell();
  await screen.findByText("Showing tus-5");
  fireEvent.click(screen.getByRole("button", { name: "United Kingdom edition" }));
  expect(nav.push).toHaveBeenCalledWith("/stats/");
  expect(localStorage.getItem("armchair.traitors.edition")).toBe("uk");
  expect(await screen.findByText("Showing tukc-2")).toBeTruthy();
});

it("changes season from the picker", async () => {
  shell();
  await screen.findByText("Showing tus-5");
  const picker = screen.getAllByRole("combobox", { name: "Season" })[0];
  fireEvent.click(picker);
  fireEvent.click(await screen.findByRole("option", { name: "Season 4" }));
  expect(nav.push).toHaveBeenCalledWith("/stats/?season=tus-4");
});

it("opens a live season before the winner bet, asking for it in a banner until it's sealed", async () => {
  const now = Date.now();
  traitors.getTraitorsSeason.mockResolvedValue({
    season: "tus-5",
    title: "",
    current: true,
    needsBet: true,
    betRoster: [{ id: "ava-stone", name: "Ava Stone", headshot: null }],
    bet: null,
    summary: null,
    cast: [],
    episodes: [1, 2, 3, 4].map((ep) => ({
      ep,
      title: null,
      releaseAt: new Date(now + (ep - 1.5) * 86_400_000).toISOString(),
      closed: false,
      events: 3,
      answered: 0,
    })),
  });
  shell();
  expect(await screen.findByText("Showing tus-5")).toBeTruthy();
  expect(screen.getAllByRole("navigation", { name: "Main" })[0]).toBeTruthy();
  const aside = screen.getByRole("complementary", { name: "Winner bet" });
  const banner = within(aside);
  // One of four episodes is out.
  expect(aside.textContent).toContain("Worth 75% now");
  fireEvent.click(banner.getByRole("button", { name: "Lock in" }));
  expect(await screen.findByRole("heading", { name: "Who takes the pot?" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Ava Stone" })).toBeTruthy();
});

it("shows a finished season's history in place of the tabs", async () => {
  nav.search = "season=tus-4";
  traitors.getTraitorsSeason.mockImplementation(async (season: string) => ({ season, title: "", current: false, needsBet: false, bet: null, episodes: [] }));
  history.getHistory.mockResolvedValue({ season: "tus-4", title: null, winners: [], players: [], episodes: [] });
  shell();
  expect(await screen.findByRole("heading", { name: "Season 4" })).toBeTruthy();
  await waitFor(() => expect(history.getHistory).toHaveBeenCalledWith("tus-4"));
  expect(screen.queryByText("Showing tus-4")).toBeNull();
  expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
  expect(screen.getByRole("main").getAttribute("aria-label")).toBe("Season history");
});

it("renders a seasonless page without loading a season, and leaves it for the overview", async () => {
  nav.path = "/players/player/";
  nav.search = "show=tus&id=ava-stone";
  render(
    <AppShell title="Player" seasonless>
      <p>A player</p>
    </AppShell>,
  );
  expect(screen.getByText("A player")).toBeTruthy();
  fireEvent.click((await screen.findAllByRole("combobox", { name: "Season" }))[0]);
  fireEvent.click(await screen.findByRole("option", { name: "Season 4" }));
  expect(nav.push).toHaveBeenCalledWith("/?season=tus-4");
  expect(traitors.getTraitorsSeason).not.toHaveBeenCalled();
});

it("lists every Armchair Judge app in the header menu and the footer, the others opening signed in", async () => {
  shell();
  await screen.findByText("Showing tus-5");
  const button = screen.getByRole("button", { name: "Armchair Judge apps" });
  fireEvent.click(button);
  const menu = button.parentElement as HTMLElement;
  expect(within(menu).getByRole("link", { name: /Dancing with the Stars/ }).getAttribute("href")).toBe(
    "https://dwts.armchairjudge.com/?sso=1",
  );
  expect(within(menu).getByRole("link", { name: /The Traitors/ }).getAttribute("aria-current")).toBe("page");
  expect(within(menu).queryByRole("link", { name: /Survivor/ })).toBeNull();

  const footer = within(screen.getByRole("contentinfo"));
  expect(footer.getByRole("link", { name: "Armchair Judge" }).getAttribute("href")).toBe("https://armchairjudge.com/?sso=1");
  expect(footer.getByText(/coming soon/)).toBeTruthy();
  expect(screen.getByText(/Not affiliated with The Traitors/)).toBeTruthy();
});

it("keeps groups in Traitors from the account menu, never on the DWTS site", async () => {
  shell();
  await screen.findByText("Showing tus-5");
  fireEvent.click(screen.getByRole("button", { name: "Account" }));
  expect(screen.getByRole("link", { name: "Your groups" }).getAttribute("href")).toMatch(/^\/groups\/?$/);
  expect(screen.getByRole("link", { name: "Friends" }).getAttribute("href")).toBe("https://armchairjudge.com/social/?sso=1");
  const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href") ?? "");
  expect(hrefs.filter((h) => /group|social/.test(h) && h.includes("dwts"))).toEqual([]);
  expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
});
