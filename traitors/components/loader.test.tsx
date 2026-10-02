import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { Loader } from "./loader";

it("announces its label politely and hides the figure from screen readers", () => {
  const { container } = render(<Loader label="Loading the episode" />);
  const status = screen.getByRole("status");
  expect(status.getAttribute("aria-live")).toBe("polite");
  expect(status.textContent).toBe("Loading the episode");
  expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

it("says Loading when given no label", () => {
  render(<Loader />);
  expect(screen.getByRole("status").textContent).toBe("Loading");
});

it("keeps gradient ids apart when two are on a page", () => {
  const { container } = render(
    <>
      <Loader />
      <Loader />
    </>,
  );
  const ids = Array.from(container.querySelectorAll("[id]"), (el) => el.id);
  expect(new Set(ids).size).toBe(ids.length);
});
