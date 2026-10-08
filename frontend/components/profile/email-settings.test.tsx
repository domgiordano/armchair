import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@armchair/app-core/api/email", () => ({ getEmailSettings: vi.fn(), setEmailSettings: vi.fn() }));

import { getEmailSettings, setEmailSettings, type EmailSettings as Settings } from "@armchair/app-core/api/email";
import { ToastProvider } from "@/components/ui/toast";
import { EmailNotice } from "@/components/email-notice";
import { EmailSettings } from "./email-settings";

const ALL_ON: Settings = {
  address: "fan@example.com",
  prefs: {
    "dwts.tonight": true,
    "dwts.closing": true,
    "dwts.digest": true,
    "traitors.tonight": true,
    "traitors.digest": true,
    social: true,
    groups: true,
  },
  noticeSeen: false,
  suppressed: false,
};

afterEach(() => vi.clearAllMocks());

const show = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

describe("EmailSettings", () => {
  it("lists DWTS's emails and the family-wide ones, not Traitors'", async () => {
    vi.mocked(getEmailSettings).mockResolvedValue(ALL_ON);
    show(<EmailSettings />);
    expect(await screen.findByRole("switch", { name: "Show-night reminder" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Before a week locks" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Group activity" })).toBeTruthy();
    expect(screen.queryByRole("switch", { name: "Release-night reminder" })).toBeNull();
    expect(screen.getByText(/fan@example.com/)).toBeTruthy();
  });

  it("saves a flip, and puts it back when the save fails", async () => {
    vi.mocked(getEmailSettings).mockResolvedValue(ALL_ON);
    vi.mocked(setEmailSettings).mockResolvedValueOnce({ ...ALL_ON, prefs: { ...ALL_ON.prefs, "dwts.digest": false } });
    show(<EmailSettings />);
    const digest = await screen.findByRole("switch", { name: "Weekly results" });
    fireEvent.click(digest);
    expect(setEmailSettings).toHaveBeenCalledWith({ prefs: { "dwts.digest": false } });
    await waitFor(() => expect(digest.getAttribute("aria-checked")).toBe("false"));

    vi.mocked(setEmailSettings).mockRejectedValueOnce(new Error("Network down"));
    fireEvent.click(digest);
    expect(await screen.findByText("Network down")).toBeTruthy();
    await waitFor(() => expect(digest.getAttribute("aria-checked")).toBe("false"));
  });

  it("warns when the address is suppressed", async () => {
    vi.mocked(getEmailSettings).mockResolvedValue({ ...ALL_ON, suppressed: true });
    show(<EmailSettings />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/bounced or was marked as spam/);
  });
});

describe("EmailNotice", () => {
  it("shows until dismissed, then stays gone", async () => {
    vi.mocked(getEmailSettings).mockResolvedValue(ALL_ON);
    vi.mocked(setEmailSettings).mockResolvedValue({ ...ALL_ON, noticeSeen: true });
    show(<EmailNotice />);
    fireEvent.click(await screen.findByRole("button", { name: "Got it" }));
    expect(setEmailSettings).toHaveBeenCalledWith({ noticeSeen: true });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Got it" })).toBeNull());
  });

  it("is never shown to someone who already dismissed it", async () => {
    vi.mocked(getEmailSettings).mockResolvedValue({ ...ALL_ON, noticeSeen: true });
    const { container } = show(<EmailNotice />);
    await waitFor(() => expect(getEmailSettings).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
