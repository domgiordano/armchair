import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/friends/",
  useRouter: () => ({ replace: nav.replace, push: nav.replace }),
  useSearchParams: () => nav.params,
}));
vi.mock("@/components/signed-in", () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@armchair/app-core/api/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@armchair/app-core/api/social")>()),
  addFriend: vi.fn(),
}));

import { addFriend } from "@armchair/app-core/api/social";
import { FriendsRoute, legacyTarget } from "./friend-link";

beforeEach(() => {
  nav.params = new URLSearchParams();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("FriendsRoute", () => {
  it("sends the invite link's request, then opens their profile", async () => {
    nav.params = new URLSearchParams({ add: "k".repeat(16) });
    vi.mocked(addFriend).mockResolvedValue({ status: "outgoing", user: { sub: "b", name: "Bea", picture: null, avatarKind: null } });
    render(<FriendsRoute />);
    await vi.waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/profile/?u=b"));
    expect(addFriend).toHaveBeenCalledWith({ code: "k".repeat(16) });
  });

  it("says why a bad link didn't work", async () => {
    nav.params = new URLSearchParams({ add: "nope" });
    vi.mocked(addFriend).mockRejectedValue(new Error("No such invite"));
    render(<FriendsRoute />);
    expect((await screen.findByRole("alert")).textContent).toContain("No such invite");
  });

  it("sends a bare /friends/ to your friends list", () => {
    render(<FriendsRoute />);
    expect(nav.replace).toHaveBeenCalledWith("/profile/?sheet=friends");
  });
});

describe("legacyTarget", () => {
  it.each([
    ["tab=requests", "/profile/?sheet=requests"],
    ["tab=groups", "/profile/?sheet=groups"],
    ["tab=groups&group=abc", "/groups/?id=abc"],
    ["", "/profile/?sheet=friends"],
  ])("%s goes to %s", (query, to) => {
    expect(legacyTarget(new URLSearchParams(query))).toBe(to);
  });
});
