import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CoupleLink, CoupleNames, PersonLink } from "@/components/couple-names";
import type { Member } from "@/lib/api/show";

const PAIR: Member[] = [
  { name: "Witney Carson", role: "pro", headshot: null },
  { name: "Tyler Cameron", role: "celebrity", headshot: null },
];

const href = (name: string | RegExp) => screen.getByRole("link", { name }).getAttribute("href");

describe("links between people and couples", () => {
  it("names the celebrity first, each name opening their page, and reads as one name", () => {
    render(
      <h3>
        <CoupleNames members={PAIR} />
      </h3>,
    );
    expect(screen.getByRole("heading").textContent).toBe("Tyler Cameron & Witney Carson");
    expect(href("Tyler Cameron")).toMatch(/^\/people\/?\?id=tyler-cameron$/);
    expect(href("Witney Carson")).toMatch(/^\/people\/?\?id=witney-carson$/);
  });

  it("opens the couple's page for the season from their faces, named for a screen reader", () => {
    render(<CoupleLink members={PAIR} season="dwts-34" />);
    expect(href("Tyler Cameron & Witney Carson, couple page")).toMatch(/^\/couples\/couple\/?\?id=tyler-cameron&season=dwts-34$/);
  });

  it("takes text in place of the faces", () => {
    render(
      <CoupleLink members={PAIR} season="dwts-35">
        Their season
      </CoupleLink>,
    );
    expect(href("Their season")).toMatch(/^\/couples\/couple\/?\?id=tyler-cameron&season=dwts-35$/);
  });

  it("doesn't also fire the row it sits in", () => {
    const row = vi.fn();
    render(
      <ul>
        <li onClick={row}>
          <CoupleLink members={PAIR} season="dwts-35" />
          <PersonLink id="tyler-cameron" name="Tyler Cameron" />
        </li>
      </ul>,
    );
    fireEvent.click(screen.getByRole("link", { name: /couple page/ }));
    fireEvent.click(screen.getByRole("link", { name: "Tyler Cameron" }));
    expect(row).not.toHaveBeenCalled();
  });
});
