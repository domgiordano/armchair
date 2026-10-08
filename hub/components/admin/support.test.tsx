import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { calls, stubApi } from "../account/test-api";
import { AdminConsole } from "./console";
import { ADMIN_EMAIL, ANSWERS_DWTS, ANSWERS_TRAITORS, DETAIL, PAT, SAM } from "./test-fixtures";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: async () => ({ tokens: { idToken: { toString: () => "id-token", payload: { sub: "me-1" } } } }),
  getCurrentUser: async () => ({ userId: "me-1" }),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@armchair/app-core/auth/amplify", () => ({ authConfigured: true }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/" }));

const ok = (data: unknown = {}) => () => ({ data });

function open(overrides = {}) {
  window.history.replaceState(null, "", `/admin/?tab=users&user=${PAT}`);
  const fetchMock = stubApi({
    "/admin/me": ok({ email: ADMIN_EMAIL }),
    "/admin/user": () => ({ data: DETAIL, meta: { next: null } }),
    "/admin/users": () => ({ data: [], meta: {} }),
    "/admin/profile": ok(DETAIL.profile),
    "/admin/membership": ok({ member: true, linked: true, invited: false }),
    "/admin/friendship": ok({ a: null, b: null }),
    "/admin/delete": ok({ deleted: PAT }),
    "/admin/answers": (_b, _i, url) => ({ data: url.searchParams.get("season") === "tus-5" ? ANSWERS_TRAITORS : ANSWERS_DWTS }),
    "/admin/answer": ok({ answer: { value: 6 } }),
    "/admin/view": ok({ screen: "overview", status: 200, data: { season: "dwts-35", answered: 12 }, error: null }),
    ...overrides,
  });
  render(<AdminConsole />);
  return fetchMock;
}

const sent = (fetchMock: ReturnType<typeof stubApi>, path: string) =>
  calls(fetchMock, path).map(([, init]) => JSON.parse((init as RequestInit).body as string) as Record<string, unknown>);

function giveReason(form: HTMLElement, reason: string) {
  fireEvent.change(within(form).getByLabelText("Reason (kept in the audit log)"), { target: { value: reason } });
}

describe("admin support tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renames only with a reason, then reloads the user", async () => {
    const fetchMock = open();
    fireEvent.click(await screen.findByRole("button", { name: "Rename" }));
    const form = screen.getByRole("form", { name: "Rename" });
    fireEvent.change(within(form).getByLabelText("Display name"), { target: { value: "Pat C." } });
    const submit = within(form).getByRole("button", { name: "Rename" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    giveReason(form, "asked to shorten it");
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await vi.waitFor(() => expect(calls(fetchMock, "/admin/user")).toHaveLength(2));
    expect(sent(fetchMock, "/admin/profile")).toEqual([{ sub: PAT, reason: "asked to shorten it", name: "Pat C." }]);
  });

  it("deletes only once the email is typed back", async () => {
    const fetchMock = open();
    fireEvent.click(await screen.findByRole("button", { name: "Delete account" }));
    const form = screen.getByRole("form", { name: "Delete account" });
    giveReason(form, "asked by email");
    const submit = within(form).getByRole("button", { name: "Delete account" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(within(form).getByLabelText(`Type ${DETAIL.profile.email} to confirm`), { target: { value: "PAT@example.com" } });
    fireEvent.click(submit);
    await vi.waitFor(() => expect(sent(fetchMock, "/admin/delete")).toHaveLength(1));
    expect(sent(fetchMock, "/admin/delete")[0]).toMatchObject({ sub: PAT, confirm: "PAT@example.com" });
    expect(await screen.findByRole("heading", { name: /Users/ })).toBeTruthy();
  });

  it("repairs a stuck join and unblocks a friend", async () => {
    const fetchMock = open();
    const groups = await screen.findByRole("region", { name: "Groups" });
    expect(within(groups).getAllByRole("button", { name: "Repair" })).toHaveLength(1);
    fireEvent.click(within(groups).getByRole("button", { name: "Repair" }));
    const repair = within(groups).getByRole("form", { name: "Repair" });
    giveReason(repair, "never showed up");
    fireEvent.click(within(repair).getByRole("button", { name: "Repair" }));
    await vi.waitFor(() =>
      expect(sent(fetchMock, "/admin/membership")).toEqual([{ sub: PAT, group: "bbbbbbbbbbbb", action: "repair", reason: "never showed up" }]),
    );

    const friends = screen.getByRole("region", { name: "Friends and blocks" });
    fireEvent.click(within(friends).getByRole("button", { name: "Unblock" }));
    const unblock = within(friends).getByRole("form", { name: "Unblock" });
    giveReason(unblock, "blocked by mistake");
    fireEvent.click(within(unblock).getByRole("button", { name: "Unblock" }));
    await vi.waitFor(() => expect(sent(fetchMock, "/admin/friendship")).toEqual([{ a: PAT, b: SAM, action: "unblock", reason: "blocked by mistake" }]));
    expect(within(friends).getByRole("button", { name: "Unfriend" })).toBeTruthy();
  });

  it("fixes a live DWTS score", async () => {
    const fetchMock = open();
    const fixer = await screen.findByRole("region", { name: "Fix a score or pick" });
    fireEvent.change(within(fixer).getByLabelText("Episode"), { target: { value: "04" } });
    fireEvent.click(within(fixer).getByRole("button", { name: "Load answers" }));
    expect(await within(fixer).findByText(/Taking answers/)).toBeTruthy();
    expect(within(fixer).getByText("Scored 8 · set by an admin")).toBeTruthy();
    expect(within(fixer).getByText("Revealed without answering")).toBeTruthy();

    fireEvent.click(within(fixer).getAllByRole("button", { name: "Fix" })[1]);
    const form = within(fixer).getByRole("form", { name: "Fix" });
    fireEvent.change(within(form).getByLabelText("Score"), { target: { value: "6" } });
    giveReason(form, "app froze");
    fireEvent.click(within(form).getByRole("button", { name: "Fix" }));
    await vi.waitFor(() => expect(sent(fetchMock, "/admin/answer")).toHaveLength(1));
    expect(sent(fetchMock, "/admin/answer")[0]).toEqual({
      sub: PAT,
      season: "dwts-35",
      ep: "4",
      key: "tyler-cameron#1",
      reason: "app froze",
      value: 6,
    });
  });

  it("needs OVERRIDE typed for a closed Traitors episode", async () => {
    const fetchMock = open();
    const fixer = await screen.findByRole("region", { name: "Fix a score or pick" });
    fireEvent.change(within(fixer).getByLabelText("Season"), { target: { value: "tus-5" } });
    fireEvent.change(within(fixer).getByLabelText("Episode"), { target: { value: "02" } });
    fireEvent.click(within(fixer).getByRole("button", { name: "Load answers" }));
    expect(await within(fixer).findByText(/Closed: changes need an override/)).toBeTruthy();

    fireEvent.click(within(fixer).getAllByRole("button", { name: "Fix" })[0]);
    const form = within(fixer).getByRole("form", { name: "Fix" });
    fireEvent.change(within(form).getByLabelText("Pick 1"), { target: { value: "eve" } });
    giveReason(form, "picked before the cut-off");
    const submit = within(form).getByRole("button", { name: "Fix" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(within(form).getByLabelText(/Type OVERRIDE/), { target: { value: "OVERRIDE" } });
    fireEvent.click(submit);
    await vi.waitFor(() => expect(sent(fetchMock, "/admin/answer")).toHaveLength(1));
    expect(sent(fetchMock, "/admin/answer")[0]).toMatchObject({ key: "MURDER", picks: ["eve"], override: true, confirm: "OVERRIDE" });
  });

  it("shows a screen as the user sees it", async () => {
    const fetchMock = open();
    const panel = await screen.findByRole("region", { name: "See what they see" });
    fireEvent.click(within(panel).getByRole("button", { name: "View" }));
    expect(await within(panel).findByText(/"answered": 12/)).toBeTruthy();
    const [url] = calls(fetchMock, "/admin/view")[0] as [string];
    const params = new URL(url, "http://api.test").searchParams;
    expect(Object.fromEntries(params)).toEqual({ as: PAT, screen: "overview", season: "dwts-35" });
  });
});
