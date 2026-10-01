import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CoupleAvatars, coupleName } from "@/components/headshot";
import type { Member } from "@/lib/api/show";

const shot = { file: "Witney Carson (cropped).jpg", author: "a", license: "CC BY 4.0", sourceUrl: "u" };
const pair: Member[] = [
  { name: "Robert Irwin", role: "celebrity", headshot: null },
  { name: "Witney Carson", role: "pro", headshot: shot },
];

describe("CoupleAvatars", () => {
  it("shows both people: a photo where there is one, initials where not", () => {
    const { container } = render(<CoupleAvatars members={pair} />);
    expect(screen.getByText("RI")).toBeTruthy();
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toMatch(/\/headshots\/Witney%20Carson%20\(cropped\)\.jpg$/);
  });

  it("puts the celebrity first whatever the member order", () => {
    const { container } = render(<CoupleAvatars members={[...pair].reverse()} />);
    expect(container.firstElementChild?.firstElementChild?.textContent).toBe("RI");
  });

  it("falls back to initials when the photo fails to load", () => {
    const { container } = render(<CoupleAvatars members={pair} />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("WC")).toBeTruthy();
  });

  it("names the couple celebrity first", () => {
    expect(coupleName({ members: pair })).toBe("Robert Irwin & Witney Carson");
  });
});
