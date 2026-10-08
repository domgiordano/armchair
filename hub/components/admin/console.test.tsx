import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { calls, stubApi } from "../account/test-api";
import { AdminConsole } from "./console";
import { POLL_MS } from "./live-tab";
import { ADMIN_EMAIL, AUDIT, DETAIL, OVERVIEW, PAT, RECENT, USERS } from "./test-fixtures";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: async () => ({ tokens: { idToken: { toString: () => "id-token", payload: { sub: "me-1" } } } }),
  getCurrentUser: async () => ({ userId: "me-1" }),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@armchair/app-core/auth/amplify", () => ({ authConfigured: true }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/" }));

const ADMIN_ROUTES = {
  "/admin/me": () => ({ data: { email: ADMIN_EMAIL } }),
  "/admin/overview": () => ({ data: OVERVIEW }),
  "/admin/users": () => ({ data: USERS, meta: { count: USERS.length, days: 30 } }),
  "/admin/user": () => ({ data: DETAIL, meta: { next: null } }),
  "/admin/events": () => ({ data: RECENT }),
  "/admin/audit": () => ({ data: AUDIT, meta: { next: null } }),
};

beforeEach(() => window.history.replaceState(null, "", "/admin/"));
afterEach(() => vi.useRealTimers());

describe("admin console", () => {
  it("tells a non-admin it's admins only and asks for nothing else", async () => {
    const fetchMock = stubApi({ ...ADMIN_ROUTES, "/admin/me": () => ({ status: 403 }) });
    render(<AdminConsole />);
    expect(await screen.findByRole("heading", { name: "Admins only" })).toBeTruthy();
    expect(calls(fetchMock, "/admin/overview")).toHaveLength(0);
  });

  it("opens on the overview: totals, apps, funnel and participation", async () => {
    stubApi(ADMIN_ROUTES);
    render(<AdminConsole />);
    expect(await screen.findByText(`Signed in as ${ADMIN_EMAIL}`)).toBeTruthy();
    const mau = (await screen.findAllByText("MAU"))[0].parentElement!;
    expect(mau.textContent).toBe("MAU57");
    const apps = screen.getByRole("region", { name: "By app" });
    expect(within(apps).getByRole("row", { name: /Traitors/ }).textContent).toContain("2210");
    const funnel = screen.getByRole("region", { name: "Funnel, 30 days" });
    expect(within(funnel).getByText(/49 accounts/).textContent).toContain("86%");
    expect(screen.getByRole("region", { name: "Picks per episode · tus-5" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Active users and signups per week" })).toBeTruthy();
  });

  it("searches and sorts users, then opens one", async () => {
    stubApi(ADMIN_ROUTES);
    render(<AdminConsole />);
    fireEvent.click(await screen.findByRole("button", { name: "Users" }));
    const table = await screen.findByRole("table");
    const names = () => within(table).getAllByRole("row").slice(1).map((r) => r.textContent ?? "");
    expect(names()[0]).toContain("Pat Couch");

    fireEvent.click(within(table).getByRole("button", { name: "Sessions" }));
    expect(names()[0]).toContain("Robin Sofa");

    fireEvent.change(screen.getByLabelText("Find a user by name, email or id"), { target: { value: "sam@" } });
    expect(names()).toHaveLength(1);

    fireEvent.click(within(table).getByRole("button", { name: /Sam Recliner/ }));
    expect(await screen.findByText("pat@example.com")).toBeTruthy();
    expect(window.location.search).toContain(`user=${encodeURIComponent(USERS[2].sub)}`);
  });

  it("shows a user's groups, stuck joins, blocks, devices and activity", async () => {
    window.history.replaceState(null, "", `/admin/?tab=users&user=${PAT}`);
    stubApi(ADMIN_ROUTES);
    render(<AdminConsole />);
    const groups = await screen.findByRole("region", { name: "Groups" });
    expect(within(groups).getByText("Stuck join")).toBeTruthy();
    const friends = screen.getByRole("region", { name: "Friends and blocks" });
    expect(within(friends).getByText("Blocked them")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Devices" })).getByText("desktop")).toBeTruthy();
    const log = screen.getByRole("region", { name: "Activity log" });
    expect(within(log).getByText("scores_submit")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Admin actions on this user" })).getByText("Score button froze mid-episode")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "All users" }));
    expect(await screen.findByRole("heading", { name: /Users/ })).toBeTruthy();
  });

  it("polls live activity and stops while paused", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = stubApi(ADMIN_ROUTES);
    window.history.replaceState(null, "", "/admin/?tab=live");
    render(<AdminConsole />);
    expect(await screen.findByText("Robin Sofa")).toBeTruthy();
    expect(screen.getByText(/Signed out/)).toBeTruthy();
    expect(screen.getByText("error api")).toBeTruthy();
    expect(calls(fetchMock, "/admin/events")).toHaveLength(1);

    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
    expect(calls(fetchMock, "/admin/events")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 2));
    expect(calls(fetchMock, "/admin/events")).toHaveLength(2);
  });

  it("lists the audit log with reasons and before/after", async () => {
    window.history.replaceState(null, "", "/admin/?tab=audit");
    stubApi(ADMIN_ROUTES);
    render(<AdminConsole />);
    const log = await screen.findByRole("region", { name: "Audit log" });
    expect(within(log).getByText("membership repair")).toBeTruthy();
    expect(within(log).getByText("Joined from the link but never showed in the group")).toBeTruthy();
    expect(within(log).getAllByText(/member: true/)).toHaveLength(1);
  });
});
