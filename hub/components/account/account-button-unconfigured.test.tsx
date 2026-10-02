import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { AccountButton } from "./account-button";

vi.mock("@armchair/app-core/auth/amplify", () => ({ authConfigured: false }));

it("signs in on the hub only: a build without Cognito disables the button instead of sending people to a show", () => {
  render(<AccountButton />);
  const button = screen.getByRole("button", { name: "Sign in" });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("link")).toBeNull();
});
