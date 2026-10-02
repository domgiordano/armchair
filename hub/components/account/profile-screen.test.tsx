import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetMe } from "@/lib/me";

import { ProfileScreen } from "./profile-screen";
import { calls, ME, stubApi } from "./test-api";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: async () => ({ tokens: { idToken: { toString: () => "id-token", payload: { sub: "me-1" } } } }),
  getCurrentUser: async () => ({ userId: "me-1" }),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@armchair/app-core/auth/amplify", () => ({ authConfigured: true }));

describe("hub profile", () => {
  beforeEach(() => resetMe());

  it("renames you through the same /users/update the DWTS profile uses", async () => {
    const fetchMock = stubApi({
      "/users/update": (body) => ({ data: { ...ME, ...(body as object) } }),
    });
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit display name" }));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: " Pat C " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Pat C" })).toBeTruthy();
    const [, init] = calls(fetchMock, "/users/update")[0];
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(init?.body as string)).toEqual({ name: "Pat C" });
  });

  it("rejects a one-letter name before calling the API", async () => {
    const fetchMock = stubApi();
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit display name" }));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "P" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Use 2 to 40 characters.");
    await waitFor(() => expect(calls(fetchMock, "/users/update")).toHaveLength(0));
  });
});
