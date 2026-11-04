import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@armchair/app-core/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@armchair/app-core/api/groups")>()),
  getMyGroups: vi.fn(),
}));

import { getMyGroups, type Group } from "@armchair/app-core/api/groups";
import { FRIENDS, useGroupScope } from "@armchair/app-core/show/group-scope";
import { GroupScopeControl } from "./group-scope";
import { choose } from "./ui/select-test-utils";

const member = (sub: string) => ({ sub, name: null, picture: null, avatarKind: null });
const GROUPS: Group[] = [
  { id: "fam", name: "Family", inviteCode: "c".repeat(16), members: [member("a"), member("b")] },
  { id: "work", name: "Work", inviteCode: "d".repeat(16), members: [member("a")] },
];

function Harness({ friends, asked }: { friends?: boolean; asked?: string | null }) {
  const filter = useGroupScope("dwts", { friends, asked });
  return (
    <>
      <GroupScopeControl {...filter} />
      <output>{filter.scope ?? "everyone"}</output>
    </>
  );
}

const picked = () => screen.getByRole("status").textContent;
const combo = () => screen.findByRole("combobox", { name: "Compare with" });
const exit = () => screen.queryByRole("button", { name: "Show Everyone" });

// Node 25's own half-built localStorage shadows jsdom's, so bring one.
function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.mocked(getMyGroups).mockResolvedValue(GROUPS);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GroupScopeControl", () => {
  it("offers Everyone then each group, remembers the pick, and leaves it in one tap", async () => {
    render(<Harness />);
    fireEvent.click(await combo());
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Everyone", "Family", "Work"]);
    fireEvent.click(screen.getByRole("option", { name: "Work" }));
    expect(picked()).toBe("work");
    expect(localStorage.getItem("armchair.group")).toBe("work");
    expect((await combo()).textContent).toContain("Work");
    expect(screen.getByRole("link", { name: "Group page" }).getAttribute("href")).toMatch(/\?id=work$/);

    fireEvent.click(exit()!);
    expect(picked()).toBe("everyone");
    expect(localStorage.getItem("armchair.group")).toBeNull();
    expect(exit()).toBeNull();
  });

  it("offers Friends where the page has them, and saves it like a group", async () => {
    render(<Harness friends />);
    choose(await combo(), "Friends");
    expect(picked()).toBe(FRIENDS);
    expect(localStorage.getItem("armchair.group")).toBe(FRIENDS);
  });

  it("reads a saved Friends as Everyone where there are no Friends, without forgetting it", async () => {
    localStorage.setItem("armchair.group", FRIENDS);
    render(<Harness />);
    await combo();
    expect(picked()).toBe("everyone");
    expect(exit()).toBeNull();
    expect(localStorage.getItem("armchair.group")).toBe(FRIENDS);
  });

  it("starts on the remembered group", async () => {
    localStorage.setItem("armchair.group", "fam");
    render(<Harness />);
    expect(picked()).toBe("fam");
    expect((await combo()).textContent).toContain("Family");
  });

  it("lets the URL's scope win and saves it for every other page", async () => {
    localStorage.setItem("armchair.group", "fam");
    render(<Harness asked="work" />);
    expect(picked()).toBe("work");
    await combo();
    expect(localStorage.getItem("armchair.group")).toBe("work");
  });

  it("drops a remembered group the caller isn't in once the list arrives", async () => {
    localStorage.setItem("armchair.group", "someone-elses");
    render(<Harness />);
    await combo();
    expect(picked()).toBe("everyone");
  });

  it("still switches when storage throws", async () => {
    const refuse = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: refuse, setItem: refuse, removeItem: refuse });
    render(<Harness />);
    choose(await combo(), "Family");
    expect(picked()).toBe("fam");
  });

  it("points to starting a group when the caller has none and there are no Friends", async () => {
    vi.mocked(getMyGroups).mockResolvedValue([]);
    render(<Harness />);
    const link = await screen.findByRole("link", { name: "Start a group to compare with friends" });
    // next/link drops the trailing slash outside a trailingSlash build.
    expect(link.getAttribute("href")).toMatch(/^\/social\/?\?view=groups$/);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("says so and shows everyone when the groups fail to load", async () => {
    localStorage.setItem("armchair.group", "fam");
    vi.mocked(getMyGroups).mockRejectedValue(new Error("Network down"));
    render(<Harness />);
    expect(await screen.findByText("Couldn't load your groups. Showing everyone.")).toBeTruthy();
    expect(picked()).toBe("everyone");
  });
});
