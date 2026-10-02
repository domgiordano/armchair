import { act, fireEvent, render, screen } from "@testing-library/react";
import { signInWithRedirect } from "aws-amplify/auth";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  signInWithRedirect: vi.fn(async () => {}),
  signOut: vi.fn(),
}));
vi.mock("aws-amplify/utils", () => ({ Hub: { listen: vi.fn(() => () => {}) } }));
// The scene chunk never loads in jsdom; the intro's own tests cover it.
vi.mock("./intro/scene", () => new Promise(() => {}));

import { Landing } from "./landing";

function prefersReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const storage = localStorage;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("localStorage", storage);
  vi.clearAllMocks();
});

const skipIntro = () => fireEvent.click(screen.getByRole("button", { name: "Skip intro" }));

describe("Landing", () => {
  it("opens on the intro, and Skip goes straight to the pitch", () => {
    render(<Landing />);
    expect(screen.getByRole("region", { name: "Intro" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();

    skipIntro();
    expect(screen.queryByRole("region", { name: "Intro" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Trust no one.Call it first.");
  });

  it("skips the intro entirely for reduced motion", () => {
    prefersReducedMotion(true);
    render(<Landing />);
    expect(screen.queryByRole("region", { name: "Intro" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });

  it("signs in with Google once Amplify says nobody is signed in", async () => {
    render(<Landing />);
    skipIntro();
    const [cta] = await screen.findAllByRole("button", { name: "Sign in with Google" });
    await vi.waitFor(() => expect((cta as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(cta);
    expect(signInWithRedirect).toHaveBeenCalledWith({ provider: "Google" });
    expect(screen.getAllByRole("button", { name: "Opening Google..." })).toHaveLength(3);
  });

  it("explains the game and sets out the real points", () => {
    render(<Landing />);
    skipIntro();
    expect(screen.getByText(/rank the round table.s top three/i)).toBeTruthy();
    expect(screen.getByText(/back up to three winners/i)).toBeTruthy();

    const ledger = screen.getByRole("table", { name: "Points for each call" });
    const rows = Array.from(ledger.querySelectorAll("tbody tr")).map((tr) => [
      tr.querySelector("th")?.textContent,
      tr.querySelector("td")?.textContent,
    ]);
    expect(rows).toEqual([
      ["Your first pick is the one banished", "5"],
      ["Your second pick finishes exactly second", "3"],
      ["Your third pick finishes exactly third", "2"],
      ["A pick in the top three, wrong slot", "1"],
      ["You name the murder victim", "4"],
      ["You name the recruit", "4"],
      ["A winner, per correct pick", "20 × early"],
      ["Their faction too, Faithful or Traitor", "+10 × early"],
    ]);
  });

  it("walks through a night, the calls, blind play, friends, both editions and the FAQ", () => {
    render(<Landing />);
    skipIntro();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toHaveLength(8);
    for (const beat of ["Breakfast", "The mission", "The round table", "The turret"]) {
      expect(screen.getByRole("heading", { level: 3, name: beat })).toBeTruthy();
    }
    for (const call of ["The slate: your top three", "The murder", "The recruit", "The winners"]) {
      expect(screen.getByRole("heading", { level: 3, name: call })).toBeTruthy();
    }
    expect(screen.getByRole("heading", { level: 3, name: "The Traitors US" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "The Traitors UK" })).toBeTruthy();
    expect(screen.getByText("Can I change a call?")).toBeTruthy();
    expect(screen.getByText("An example round table. The names are made up.")).toBeTruthy();
    expect(screen.getByText("Not affiliated with The Traitors, BBC, NBC or Peacock.")).toBeTruthy();
  });

  it("chalks the votes up one at a time, and shows them all at once for reduced motion", () => {
    vi.useFakeTimers();
    const strokes = () => document.querySelectorAll("[data-drawn]").length;
    const { unmount } = render(<Landing />);
    skipIntro();
    expect(strokes()).toBe(0);
    act(() => vi.advanceTimersByTime(650 * 3));
    expect(strokes()).toBe(3);
    unmount();
    vi.useRealTimers();

    prefersReducedMotion(true);
    render(<Landing />);
    expect(strokes()).toBe(12);
  });
});
