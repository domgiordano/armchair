import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { push, signOut } = vi.hoisted(() => ({ push: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@armchair/app-core/auth/use-auth", () => ({ useAuth: () => ({ signOut }) }));
vi.mock("@armchair/app-core/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@armchair/app-core/api/client")>()),
  deleteAccount: vi.fn(),
}));

vi.mock("@armchair/app-core/api/email", () => ({
  getEmailSettings: vi.fn(() => new Promise(() => {})),
  setEmailSettings: vi.fn(),
}));

import { ApiError, deleteAccount } from "@armchair/app-core/api/client";
import { ToastProvider } from "@/components/ui/toast";
import { AccountSettings } from "./settings";

afterEach(() => {
  vi.clearAllMocks();
  window.location.hash = "";
});

const openSheet = () => {
  render(
    <ToastProvider>
      <AccountSettings />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
  const sheet = screen.getByRole("dialog", { name: "Delete your account?" });
  return {
    sheet,
    field: within(sheet).getByLabelText("Type DELETE to confirm"),
    confirm: within(sheet).getByRole("button", { name: "Delete account" }) as HTMLButtonElement,
  };
};

describe("AccountSettings", () => {
  it("says what goes, and enables the delete only once DELETE is typed", () => {
    const { sheet, field, confirm } = openSheet();
    expect(within(sheet).getByText(/Every score and Traitors pick/)).toBeTruthy();
    expect(within(sheet).getByText(/passes to the member who joined first/)).toBeTruthy();
    expect(confirm.disabled).toBe(true);

    fireEvent.change(field, { target: { value: "delete" } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(field, { target: { value: "DELETE" } });
    expect(confirm.disabled).toBe(false);
  });

  it("deletes, signs out, then goes home", async () => {
    vi.mocked(deleteAccount).mockResolvedValue({ ok: true });
    signOut.mockResolvedValue(undefined);
    const { field, confirm } = openSheet();
    fireEvent.change(field, { target: { value: "DELETE" } });
    fireEvent.click(confirm);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(push.mock.invocationCallOrder[0]);
  });

  it("toasts a failure and stays signed in", async () => {
    vi.mocked(deleteAccount).mockRejectedValue(new ApiError(500, "Internal error"));
    const { field, confirm } = openSheet();
    fireEvent.change(field, { target: { value: "DELETE" } });
    fireEvent.click(confirm);

    expect((await screen.findByRole("alert")).textContent).toContain("Internal error");
    expect(signOut).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(confirm.disabled).toBe(false);
  });

  it("clears what was typed when the sheet is closed", () => {
    const { sheet, field } = openSheet();
    fireEvent.change(field, { target: { value: "DELETE" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Keep my account" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect((screen.getByLabelText("Type DELETE to confirm") as HTMLInputElement).value).toBe("");
  });

  it("scrolls itself into view when the page was opened at #settings", () => {
    window.location.hash = "#settings";
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<AccountSettings />);
    expect(scroll).toHaveBeenCalledTimes(1);
  });
});
