import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@armchair/app-core/api/email", () => ({ getEmailSettings: vi.fn(), setEmailSettings: vi.fn() }));

import { getEmailSettings, setEmailSettings, type EmailSettings } from "@armchair/app-core/api/email";
import { ToastProvider } from "@/components/ui/toast";
import { SettingsScreen } from "./settings-screen";

const SETTINGS: EmailSettings = {
  address: "fan@example.com",
  prefs: {
    "dwts.tonight": true,
    "dwts.closing": true,
    "dwts.digest": true,
    "traitors.tonight": true,
    "traitors.digest": true,
    social: true,
    groups: false,
  },
  noticeSeen: true,
  suppressed: false,
};

afterEach(() => vi.clearAllMocks());

it("shows Traitors' emails and the family-wide ones, and saves a flip", async () => {
  vi.mocked(getEmailSettings).mockResolvedValue(SETTINGS);
  vi.mocked(setEmailSettings).mockResolvedValue({ ...SETTINGS, prefs: { ...SETTINGS.prefs, groups: true } });
  render(
    <ToastProvider>
      <SettingsScreen />
    </ToastProvider>,
  );
  expect(await screen.findByRole("switch", { name: "Release-night reminder" })).toBeTruthy();
  expect(screen.queryByRole("switch", { name: "Before a week locks" })).toBeNull();
  const groups = screen.getByRole("switch", { name: "Group activity" });
  expect(groups.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(groups);
  expect(setEmailSettings).toHaveBeenCalledWith({ prefs: { groups: true } });
  await waitFor(() => expect(groups.getAttribute("aria-checked")).toBe("true"));
});
