import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loading from "./loading";
import NotFound from "./not-found";

describe("404 and loading", () => {
  it("404 says so and leads back to the hub", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("The panel can’t score this page.");
    expect(screen.getByRole("link", { name: "Back to the hub" }).getAttribute("href")).toBe("/");
  });

  it("the loader announces itself", () => {
    render(<Loading />);
    expect(within(screen.getByRole("status")).getByText("Loading")).toBeTruthy();
  });
});
