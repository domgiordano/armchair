import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "us-east-1_test";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_COGNITO_DOMAIN = "test.auth.us-east-1.amazoncognito.com";
});

vi.mock("aws-amplify", () => ({ Amplify: { configure: vi.fn() } }));
vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: vi.fn(async () => {
    throw new Error("UserUnAuthenticatedException");
  }),
  fetchAuthSession: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("aws-amplify/utils", () => ({ Hub: { listen: vi.fn(() => () => {}) } }));

import { Home } from "./home";

it("shows the title and Google sign-in when signed out", async () => {
  render(<Home />);
  expect(screen.getByRole("heading", { name: "Traitors" })).toBeTruthy();
  const button = await screen.findByRole("button", { name: "Sign in with Google" });
  await vi.waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
});
