import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@armchair/app-core/api/groups", async (real) => ({
  ...(await real<typeof import("@armchair/app-core/api/groups")>()),
  getGroupDetails: vi.fn(),
}));
vi.mock("@armchair/app-core/api/social", () => ({ mySub: vi.fn(async () => "u1") }));
vi.mock("@armchair/app-core/social/notifications", () => ({
  useNotifications: () => ({ items: [], answer: vi.fn() }),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => vi.fn() }));

import { getGroupDetails, type GroupDetail } from "@armchair/app-core/api/groups";

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
