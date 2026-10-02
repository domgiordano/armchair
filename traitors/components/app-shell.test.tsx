import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ path: "/stats/", search: "", push: vi.fn() }));
const traitors = vi.hoisted(() => ({ getTraitorsSeason: vi.fn(), submitWinner: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.path,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push, replace: nav.push }),
}));
vi.mock("@armchair/app-core/auth/use-auth", () => ({ useAuth: () => ({ signOut: vi.fn(async () => {}) }) }));
vi.mock("@armchair/app-core/api/client", () => ({
  getMe: vi.fn(async () => ({ sub: "me", email: "me@example.com", name: "Me Myself", picture: null })),
}));
vi.mock("@/lib/api/traitors", () => traitors);
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
  expect(screen.getByRole("button", { name: "UK" }).getAttribute("aria-pressed")).toBe("true");
});

it("switches edition by dropping the old season and remembering the choice", async () => {
  shell();
  await screen.findByText("Showing tus-5");
  fireEvent.click(screen.getByRole("button", { name: "UK" }));
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

it("holds a live season behind the winner bet, with no tabs", async () => {
  traitors.getTraitorsSeason.mockResolvedValue({
    season: "tus-5",
    title: "",
    current: true,
    needsBet: true,
    episodes: 12,
    released: 0,
    players: [{ id: "ava-stone", name: "Ava Stone", headshot: null }],
  });
  shell();
  expect(await screen.findByRole("heading", { name: "Who takes the pot?" })).toBeTruthy();
  expect(screen.queryByText("Showing tus-5")).toBeNull();
  expect(screen.queryByRole("link", { name: "Leaderboard" })).toBeNull();
});
