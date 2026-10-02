import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { Headshot, initials } from "./avatar";

it("takes first and last initials", () => {
  expect(initials("Bob the Drag Queen")).toBe("BQ");
  expect(initials("Cher")).toBe("C");
  expect(initials("  ")).toBe("?");
});

it("serves a headshot from the site and falls back to initials when it fails", () => {
  render(<Headshot name="Rob Rausch" image="tus-5/rob-rausch.jpg" />);
  const img = screen.getByRole("img", { name: "Rob Rausch" });
  expect(new URL(img.getAttribute("src") ?? "", "http://x").pathname).toBe("/headshots/tus-5/rob-rausch.jpg");

  fireEvent.error(img);
  expect(screen.getByRole("img", { name: "Rob Rausch" }).textContent).toBe("RR");
});

it("shows initials before the photo pass", () => {
  render(<Headshot name="Dylan Efron" image={null} />);
  expect(screen.getByRole("img", { name: "Dylan Efron" }).textContent).toBe("DE");
});
