import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@armchair/app-core/api/groups", async (real) => ({
  ...(await real<typeof import("@armchair/app-core/api/groups")>()),
  getGroupDetails: vi.fn(),
  setGroupShow: vi.fn(),
}));
vi.mock("@armchair/app-core/api/social", () => ({ mySub: vi.fn(async () => "u1") }));
vi.mock("@armchair/app-core/social/notifications", () => ({
  useNotifications: () => ({ items: [], answer: vi.fn() }),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => vi.fn() }));

import { getGroupDetails, setGroupShow, type GroupDetail } from "@armchair/app-core/api/groups";

import { GroupsScreen } from "./groups-screen";

const person = (sub: string, name: string) => ({ sub, name, picture: null, avatarKind: "initials" as const, relation: null });
const GROUP: GroupDetail = {
  id: "g1",
  name: "Castle Crew",
  inviteCode: "c".repeat(16),
  members: [person("u1", "Ada Lovelace"), person("u2", "Sam Rivera")],
  owner: "u1",
  approval: false,
  invited: [],
  requests: [],
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test");
  vi.mocked(getGroupDetails).mockResolvedValue([GROUP]);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("keeps every group link in Traitors: its board here, and an invite that joins here", async () => {
  render(<GroupsScreen />);
  const card = within(await screen.findByRole("article", { name: "Castle Crew" }));
  expect(card.getByRole("link", { name: "Group board" }).getAttribute("href")).toMatch(/^\/leaderboard\/?\?group=g1$/);
  const link = new URL((card.getByRole("textbox", { name: "Invite link" }) as HTMLInputElement).value);
  expect(link.origin + link.pathname).toBe("https://api.test/invite/preview");
  expect(link.searchParams.get("code")).toBe("c".repeat(16));
  // The preview redirects to /join/ on this site, not the DWTS one.
  expect(link.searchParams.get("site")).toBe(window.location.origin);
  const hrefs = screen.queryAllByRole("link").map((a) => a.getAttribute("href") ?? "");
  expect(hrefs.filter((h) => h.includes("dwts"))).toEqual([]);
});

it("starts The Traitors for a group not playing it, and links the group on DWTS", async () => {
  const show = (app: "dwts" | "traitors", active: boolean, playing: string[]) => ({ app, active, by: null, at: null, playing });
  vi.mocked(getGroupDetails).mockResolvedValue([{ ...GROUP, shows: [show("dwts", true, ["u1", "u2"]), show("traitors", false, [])] }]);
  vi.mocked(setGroupShow).mockResolvedValue({ app: "traitors", active: true, started: true });
  render(<GroupsScreen />);
  const card = within(await screen.findByRole("article", { name: "Castle Crew" }));
  expect(card.queryByRole("link", { name: "Group board" })).toBeNull();
  const others = within(card.getByRole("region", { name: "Castle Crew on other shows" }));
  expect(others.getByRole("link", { name: "Open in DWTS" }).getAttribute("href")).toBe(
    "https://dwts.armchairjudge.com/groups/?id=g1&sso=1",
  );
  fireEvent.click(card.getByRole("button", { name: "Start The Traitors with this group" }));
  await vi.waitFor(() => expect(setGroupShow).toHaveBeenCalledWith("g1", "traitors", true));
});
