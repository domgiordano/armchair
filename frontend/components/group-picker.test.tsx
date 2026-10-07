import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@armchair/app-core/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@armchair/app-core/api/groups")>()),
  getMyGroups: vi.fn(),
}));

import { getMyGroups, type Group } from "@armchair/app-core/api/groups";
import { useGroupFilter } from "@/lib/show/group-filter";
import { GroupPicker } from "./group-picker";

const member = (sub: string) => ({ sub, name: null, picture: null, avatarKind: null });
const GROUPS: Group[] = [
  { id: "fam", name: "Family", inviteCode: "c".repeat(16), members: [member("a"), member("b")] },
  { id: "work", name: "Work", inviteCode: "d".repeat(16), members: [member("a")] },
];

function Harness() {
  const filter = useGroupFilter();
  return (
    <>
      <GroupPicker {...filter} panelId="panel" />
      <output>{filter.group ?? "everyone"}</output>
    </>
  );
}

const picked = () => screen.getByRole("status").textContent;
const selected = () => screen.getAllByRole("tab").find((t) => t.getAttribute("aria-selected") === "true")?.textContent;

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

describe("GroupPicker", () => {
  it("offers Global and each group as tabs, and remembers the pick", async () => {
    render(<Harness />);
    const tabs = await screen.findByRole("tablist", { name: "Compare with" });
    expect(within(tabs).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Global", "Family", "Work"]);
    expect(selected()).toBe("Global");
    expect(picked()).toBe("everyone");

    fireEvent.click(screen.getByRole("tab", { name: "Work" }));
    expect(picked()).toBe("work");
    expect(localStorage.getItem("armchair.group")).toBe("work");
    expect(screen.getByRole("link", { name: "Group page" }).getAttribute("href")).toMatch(/\?id=work$/);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Work" }), { key: "Home" });
    expect(picked()).toBe("everyone");
    expect(localStorage.getItem("armchair.group")).toBeNull();
  });

  it("starts on the remembered group", async () => {
    localStorage.setItem("armchair.group", "fam");
    render(<Harness />);
    expect(picked()).toBe("fam");
    await screen.findByRole("tablist", { name: "Compare with" });
    expect(selected()).toBe("Family");
  });

  it("drops a remembered group the caller isn't in once the list arrives", async () => {
    localStorage.setItem("armchair.group", "someone-elses");
    render(<Harness />);
    await screen.findByRole("tablist", { name: "Compare with" });
    expect(selected()).toBe("Global");
    expect(picked()).toBe("everyone");
  });

  it("still switches when storage throws", async () => {
    const refuse = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: refuse, setItem: refuse, removeItem: refuse });
    render(<Harness />);
    fireEvent.click(await screen.findByRole("tab", { name: "Family" }));
    expect(picked()).toBe("fam");
  });

  it("points to starting a group when the caller has none", async () => {
    vi.mocked(getMyGroups).mockResolvedValue([]);
    render(<Harness />);
    const link = await screen.findByRole("link", { name: "Start a group to compare with friends" });
    // next/link drops the trailing slash outside a trailingSlash build.
    expect(link.getAttribute("href")).toMatch(/^\/social\/?\?view=groups$/);
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("says so and shows everyone when the groups fail to load", async () => {
    vi.mocked(getMyGroups).mockRejectedValue(new Error("Network down"));
    render(<Harness />);
    expect(await screen.findByText("Couldn't load your groups. Showing everyone.")).toBeTruthy();
    expect(picked()).toBe("everyone");
  });
});
