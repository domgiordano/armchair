import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppsMenu } from "@/components/apps-menu";
import { ICON_TRIGGER } from "@/components/show-icon";

const toggle = () => screen.getByRole("button", { name: "Apps" });

function renderOpen() {
  render(
    <>
      <AppsMenu />
      <p>Elsewhere</p>
    </>,
  );
  fireEvent.click(toggle());
  return document.getElementById(toggle().getAttribute("aria-controls") ?? "") as HTMLElement;
}

describe("AppsMenu", () => {
  it("starts closed", () => {
    render(<AppsMenu />);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Dancing with the Stars")).toBeNull();
  });

  it("links the live app and leaves coming-soon apps unclickable", () => {
    const panel = renderOpen();
    expect(toggle().getAttribute("aria-expanded")).toBe("true");

    const dwts = within(panel).getByRole("link", { name: /Dancing with the Stars/ });
    expect(dwts.getAttribute("href")).toBe("https://dwts.armchairjudge.com");
    expect(dwts.textContent).toContain("LIVE");

    for (const name of ["The Traitors", "Survivor"]) {
      const row = within(panel).getByText(name);
      expect(row.closest("a")).toBeNull();
      expect(row.parentElement?.parentElement?.textContent).toContain("COMING SOON");
    }
  });

  it("gives each app its icon, padlocked until the app is live, played by hovering its row", () => {
    const panel = renderOpen();
    const rows = within(panel).getAllByRole("listitem").slice(0, 3);
    expect(rows.map((li) => li.querySelector("[data-show]")?.getAttribute("data-show"))).toEqual(["dwts", "traitors", "survivor"]);
    for (const li of rows) expect(li.firstElementChild?.classList.contains(ICON_TRIGGER)).toBe(true);
    const locked = rows.map((li) => li.querySelector("[data-show]")?.querySelector("span") !== null);
    expect(locked).toEqual([false, true, true]);
  });

  it("closes on Escape and hands focus back to the button", () => {
    renderOpen();
    const dwts = screen.getByRole("link", { name: /Dancing with the Stars/ });
    dwts.focus();
    fireEvent.keyDown(dwts, { key: "Escape" });
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle());
  });

  it("closes on a click outside, not on a click inside", () => {
    renderOpen();
    fireEvent.pointerDown(screen.getByText("The Traitors"));
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerDown(screen.getByText("Elsewhere"));
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when a section link is followed", () => {
    renderOpen();
    fireEvent.click(screen.getByRole("link", { name: "How it works" }));
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("moves through the rows with the arrow keys, wrapping at the ends", () => {
    const panel = renderOpen();
    const links = within(panel).getAllByRole("link");
    links[0].focus();
    fireEvent.keyDown(links[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(links[links.length - 1]);
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
    expect(document.activeElement).toBe(links[0]);
    fireEvent.keyDown(links[0], { key: "End" });
    expect(document.activeElement).toBe(links[links.length - 1]);
  });

  it("opens from the keyboard with ArrowDown and focuses the first app", async () => {
    render(<AppsMenu />);
    fireEvent.keyDown(toggle(), { key: "ArrowDown" });
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    const first = screen.getByRole("link", { name: /Dancing with the Stars/ });
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.activeElement).toBe(first);
  });

  it("closes when focus tabs out of the menu", () => {
    renderOpen();
    const outside = document.createElement("button");
    document.body.append(outside);
    fireEvent.blur(screen.getByRole("link", { name: /Dancing with the Stars/ }), { relatedTarget: outside });
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    outside.remove();
  });
});
