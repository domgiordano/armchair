import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/groups")>()),
  getMyGroups: vi.fn(),
}));

import { getMyGroups, type Group } from "@/lib/api/groups";
import { useGroupFilter } from "@/lib/show/group-filter";
import { GroupPicker } from "./group-picker";
import { choose } from "./ui/select-test-utils";

const member = (sub: string) => ({ sub, name: null, picture: null, avatarKind: null });
const GROUPS: Group[] = [
  { id: "fam", name: "Family", inviteCode: "c".repeat(16), members: [member("a"), member("b")] },
  { id: "work", name: "Work", inviteCode: "d".repeat(16), members: [member("a")] },
];

function Harness() {
  const filter = useGroupFilter();
  return (
    <>
      <GroupPicker {...filter} />
      <output>{filter.group ?? "everyone"}</output>
    </>
  );
}

const picked = () => screen.getByRole("status").textContent;

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
  it("offers Everyone and each group, and remembers the pick", async () => {
    render(<Harness />);
    const select = await screen.findByRole("combobox", { name: "Compare with" });
    fireEvent.click(select);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Everyone", "Family (2)", "Work (1)"]);
    fireEvent.click(select);
    expect(picked()).toBe("everyone");

    choose(select, "Work (1)");
    expect(picked()).toBe("work");
    expect(localStorage.getItem("armchair.group")).toBe("work");

    choose(select, "Everyone");
    expect(picked()).toBe("everyone");
    expect(localStorage.getItem("armchair.group")).toBeNull();
  });

  it("starts on the remembered group", async () => {
    localStorage.setItem("armchair.group", "fam");
    render(<Harness />);
    expect(picked()).toBe("fam");
    expect((await screen.findByRole("combobox", { name: "Compare with" })).textContent).toBe("Family (2)");
  });

  it("drops a remembered group the caller isn't in once the list arrives", async () => {
    localStorage.setItem("armchair.group", "someone-elses");
    render(<Harness />);
    expect((await screen.findByRole("combobox", { name: "Compare with" })).textContent).toBe("Everyone");
    expect(picked()).toBe("everyone");
  });

  it("still switches when storage throws", async () => {
    const refuse = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: refuse, setItem: refuse, removeItem: refuse });
    render(<Harness />);
    choose(await screen.findByRole("combobox", { name: "Compare with" }), "Family (2)");
    expect(picked()).toBe("fam");
  });

  it("points to starting a group when the caller has none", async () => {
    vi.mocked(getMyGroups).mockResolvedValue([]);
    render(<Harness />);
    const link = await screen.findByRole("link", { name: "Start a group to compare with friends" });
    // next/link drops the trailing slash outside a trailingSlash build.
    expect(link.getAttribute("href")).toMatch(/^\/friends\/?\?tab=groups$/);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("says so and shows everyone when the groups fail to load", async () => {
    vi.mocked(getMyGroups).mockRejectedValue(new Error("Network down"));
    render(<Harness />);
    expect(await screen.findByText("Couldn't load your groups. Showing everyone.")).toBeTruthy();
    expect(picked()).toBe("everyone");
  });
});
