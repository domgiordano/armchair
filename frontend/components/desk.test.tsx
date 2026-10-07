import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@armchair/app-core/api/client", () => ({ getMe: vi.fn() }));

import { getMe } from "@armchair/app-core/api/client";
import type { Judge, JudgeSeat, RevealedCard } from "@/lib/api/show";
import { Desk } from "./desk";

const JUDGES: Judge[] = [
  { id: "carrie-ann-inaba", name: "Carrie Ann Inaba", headshot: null },
  { id: "derek-hough", name: "Derek Hough", headshot: null },
  { id: "bruno-tonioli", name: "Bruno Tonioli", headshot: null },
  { id: "guest", name: "Guest Judge", headshot: null },
];
const judgeMap = new Map(JUDGES.map((j) => [j.id, j]));

const card = (judges: JudgeSeat[], patch: Partial<RevealedCard> = {}): RevealedCard => ({
  key: "tyler-cameron#1",
  contestants: ["tyler-cameron"],
  n: 1,
  style: null,
  song: null,
  locked: false,
  judges,
  mine: { value: 6 },
  others: [],
  aggregate: { count: 12, mean: 7.25 },
  ...patch,
});

const confirmed = (n: number): JudgeSeat[] =>
  JUDGES.slice(0, n).map((j) => ({ id: j.id, value: 8, state: "confirmed" }));

const seats = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>("[data-seat]")];
const seat = (container: HTMLElement, plate: string) =>
  seats(container).find((s) => within(s).queryByText(plate) !== null)!;
const paddle = (el: HTMLElement) => el.querySelector("[data-paddle]")!;

beforeEach(() => {
  vi.mocked(getMe).mockRejectedValue(new Error("offline"));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Desk", () => {
  it.each([2, 3, 4])("seats a %i-judge panel, you and everyone", (n) => {
    const { container } = render(
      <Desk card={card(confirmed(n))} judges={judgeMap}>
        list
      </Desk>,
    );
    expect(seats(container).map((s) => s.dataset.seat)).toEqual([
      ...Array<string>(n).fill("judge"),
      "you",
      "crowd",
    ]);
  });

  it("shows the everyone-average paddle with its count", () => {
    const { container } = render(
      <Desk card={card(confirmed(3))} judges={judgeMap}>
        list
      </Desk>,
    );
    const all = seat(container, "All");
    expect(paddle(all).textContent).toBe("7.3");
    expect(within(all).getByText("12 scores")).toBeTruthy();
    expect(screen.getByRole("group", { name: /everyone 7\.3 from 12 scores$/ })).toBeTruthy();
  });

  it("keeps a pending judge's paddle down, and dashes a provisional one", () => {
    const { container } = render(
      <Desk
        card={card([
          { id: "carrie-ann-inaba", value: 8, state: "confirmed" },
          { id: "derek-hough", value: 7.5, state: "provisional" },
          { id: "bruno-tonioli", value: null, state: "pending" },
        ])}
        judges={judgeMap}
      >
        list
      </Desk>,
    );
    const [carrie, derek, bruno] = ["Carrie", "Derek", "Bruno"].map((p) => seat(container, p));

    expect(carrie.dataset.state).toBe("confirmed");
    expect(paddle(carrie).textContent).toBe("8");
    expect(carrie.querySelector("[stroke-dasharray]")).toBeNull();

    expect(derek.dataset.state).toBe("provisional");
    expect(paddle(derek).textContent).toBe("7.5");
    expect(derek.querySelector("[stroke-dasharray]")).not.toBeNull();

    expect(bruno.dataset.state).toBe("pending");
    expect(paddle(bruno).getAttribute("data-paddle")).toBe("down");
    expect(paddle(bruno).textContent).toBe("");
    expect(within(bruno).getByText("pending")).toBeTruthy();

    expect(screen.getByText("Dashed paddles are unconfirmed.")).toBeTruthy();
    expect(
      screen.getByRole("group", {
        name: /^Judges' desk: Carrie Ann Inaba 8, Derek Hough 7\.5 unconfirmed, Bruno Tonioli pending, you 6/,
      }),
    ).toBeTruthy();
  });

  it("raises paddles only when motion is allowed", () => {
    const { container } = render(
      <Desk
        card={card([
          { id: "carrie-ann-inaba", value: 8, state: "confirmed" },
          { id: "derek-hough", value: null, state: "pending" },
        ])}
        judges={judgeMap}
      >
        list
      </Desk>,
    );
    const up = container.querySelectorAll('[data-paddle="up"]');
    expect(up.length).toBe(3);
    for (const p of up) {
      // Under prefers-reduced-motion the class does not apply, so the paddle
      // renders at its resting raised position with no animation.
      expect(p.getAttribute("class")?.split(" ")).toEqual(["motion-safe:animate-raise"]);
    }
    expect(paddle(seat(container, "Derek")).getAttribute("class")).not.toMatch(/animate/);
  });

  it("puts your name and paddle in your seat once /users/me loads", async () => {
    vi.mocked(getMe).mockResolvedValue({
      sub: "s",
      email: "viewer@example.com",
      name: "Pat Viewer",
      picture: null,
      avatarKind: "initials",
      createdAt: "",
      lastSeenAt: "",
    });
    const { container } = render(
      <Desk card={card(confirmed(3))} judges={judgeMap}>
        list
      </Desk>,
    );
    const you = await screen.findByText("Pat");
    expect(you.closest("[data-seat]")?.getAttribute("data-seat")).toBe("you");
    expect(paddle(seat(container, "Pat")).textContent).toBe("6");
  });

  it("lowers your paddle when you revealed without scoring", () => {
    const { container } = render(
      <Desk card={card(confirmed(3), { mine: { forfeit: true } })} judges={judgeMap}>
        list
      </Desk>,
    );
    const you = container.querySelector<HTMLElement>('[data-seat="you"]')!;
    expect(you.dataset.state).toBe("pending");
    expect(within(you).getByText("skipped")).toBeTruthy();
  });

  it("marks a guest judge's seat and says so to a screen reader", () => {
    const guest = new Map(judgeMap).set("guest", { ...JUDGES[3], guest: true, weeks: [5] });
    const { container } = render(
      <Desk card={card([...confirmed(3), { id: "guest", value: 9, state: "confirmed" }])} judges={guest}>
        list
      </Desk>,
    );
    expect(within(seat(container, "Guest")).getByText("guest")).toBeTruthy();
    expect(within(seat(container, "Carrie")).queryByText("guest")).toBeNull();
    expect(screen.getByRole("link", { name: "Guest Judge, guest judge, 9" })).toBeTruthy();
  });

  it("keeps the number list under Details", () => {
    render(
      <Desk card={card(confirmed(2))} judges={judgeMap}>
        <p>number list</p>
      </Desk>,
    );
    expect(screen.getByText("number list").closest("details")?.querySelector("summary")?.textContent).toBe(
      "Details",
    );
  });
});
