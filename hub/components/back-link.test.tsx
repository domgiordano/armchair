import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

import { resetHistory } from "@/lib/back";
import { BackLink } from "./back-link";

afterEach(() => {
  vi.restoreAllMocks();
  nav.pathname = "/";
  resetHistory();
  window.history.replaceState(null, "");
});

describe("BackLink", () => {
  it.each(["/", "/stats/", "/leaderboards/", "/social/"])("is absent on the %s tab", (path) => {
    nav.pathname = path;
    render(<BackLink />);
    expect(screen.queryByRole("link", { name: "Back" })).toBeNull();
  });

  it.each(["/privacy/", "/terms/", "/profile/"])("links home from %s when opened directly", (path) => {
    nav.pathname = path;
    const back = vi.spyOn(window.history, "back");
    render(<BackLink />);
    const link = screen.getByRole("link", { name: "Back" });
    expect(link.getAttribute("href")).toMatch(/^\/$/);
    fireEvent.click(link);
    expect(back).not.toHaveBeenCalled();
  });

  it("steps back through history after an in-hub navigation", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { rerender } = render(<BackLink />);

    window.history.pushState(null, "", "/terms/");
    nav.pathname = "/terms/";
    rerender(<BackLink />);

    expect(fireEvent.click(screen.getByRole("link", { name: "Back" }))).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
  });
});
