import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getPlayer: vi.fn() }));
vi.mock("@/lib/api/history", () => api);

import { RoundTable } from "./round-table";

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${String.fromCharCode(65 + i)}`, headshot: null }));
const table = (name: string) => within(screen.getByRole("group", { name }));
const head = (name: string) => table(name).getAllByRole("button").find((b) => b.getAttribute("aria-current") === "true");
const card = () => screen.getByRole("region", { name: /^At the head of the table/ });

beforeEach(() => {
  api.getPlayer.mockReturnValue(new Promise(() => {}));
});
afterEach(() => vi.clearAllMocks());

it("seats a dozen with the first at the head, and no list toggle", () => {
  render(<RoundTable roster={players(12)} kind="MURDER" season="tus-5" chosen={[]} onTap={vi.fn()} />);
  expect(table("Who is murdered").getAllByRole("button")).toHaveLength(12);
  expect(head("Who is murdered")?.getAttribute("aria-label")).toBe("Player A");
  expect(within(card()).getByRole("heading", { name: "Player A" })).toBeTruthy();
  expect(within(card()).getByText("US · Season 5")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "List" })).toBeNull();
});

it("turns with the arrow buttons and the arrow keys, wrapping past the last seat", () => {
  render(<RoundTable roster={players(12)} kind="RT" season="tus-5" chosen={[]} onTap={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Turn to the next player" }));
  expect(head("The round table vote")?.getAttribute("aria-label")).toBe("Player B");
  fireEvent.click(screen.getByRole("button", { name: "Turn to the previous player" }));
  fireEvent.click(screen.getByRole("button", { name: "Turn to the previous player" }));
  expect(head("The round table vote")?.getAttribute("aria-label")).toBe("Player L");

  const group = screen.getByRole("group", { name: "The round table vote" });
  fireEvent.keyDown(group, { key: "ArrowRight" });
  expect(head("The round table vote")?.getAttribute("aria-label")).toBe("Player A");
  // From a seat, focus follows the head round.
  const a = head("The round table vote")!;
  a.focus();
  fireEvent.keyDown(a, { key: "ArrowRight" });
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Player B");
  expect(within(card()).getByRole("heading", { name: "Player B" })).toBeTruthy();
});

it("turns a tapped seat to the head first, and only then calls it", () => {
  const onTap = vi.fn();
  render(
    <RoundTable
      roster={players(12)}
      kind="MURDER"
      season="tus-5"
      chosen={[]}
      onTap={onTap}
      actions={(p) => <button type="button">Choose {p.name}</button>}
    />,
  );
  const seat = () => screen.getByRole("button", { name: "Player D" });
  fireEvent.click(seat());
  expect(onTap).not.toHaveBeenCalled();
  expect(seat().getAttribute("aria-current")).toBe("true");
  expect(within(card()).getByRole("button", { name: "Choose Player D" })).toBeTruthy();
  fireEvent.click(seat());
  expect(onTap).toHaveBeenCalledWith("p3");
});

it("turns with a drag and snaps to the nearest seat, without the drag tapping a seat", () => {
  const onTap = vi.fn();
  render(<RoundTable roster={players(12)} kind="MURDER" season="tus-5" chosen={[]} onTap={onTap} />);
  const group = screen.getByRole("group", { name: "Who is murdered" });
  const a = screen.getByRole("button", { name: "Player A" });
  // Dragging left brings the seats on the right up to the head.
  fireEvent.pointerDown(a, { pointerId: 1, button: 0, clientX: 300 });
  fireEvent.pointerMove(group, { pointerId: 1, clientX: 250 });
  fireEvent.pointerMove(group, { pointerId: 1, clientX: 190 });
  fireEvent.pointerUp(group, { pointerId: 1, clientX: 190 });
  fireEvent.click(a);
  expect(onTap).not.toHaveBeenCalled();
  const label = head("Who is murdered")?.getAttribute("aria-label");
  expect(["Player B", "Player C", "Player D", "Player E"]).toContain(label);
});

it("opens the head's page from Read more, while a tap elsewhere only turns the table", async () => {
  api.getPlayer.mockResolvedValue({
    id: "p2",
    name: "Player C",
    headshot: null,
    bio: { text: "A teacher from Ohio who came to win.", sourceUrl: null },
    about: { age: 34, hometown: "Dayton, Ohio", occupation: "Teacher" },
    seasons: [],
  });
  render(
    <RoundTable roster={players(5)} kind="RT" season="tuk-3" chosen={[]} hrefOf={(id) => `/p/${id}`} label="Cast" />,
  );
  const c = screen.getByRole("link", { name: "Player C" });
  expect(fireEvent.click(c)).toBe(false);
  expect(c.getAttribute("aria-current")).toBe("true");
  expect(within(card()).getByRole("link", { name: "Read more about Player C" }).getAttribute("href")).toBe("/p/p2");
  expect(within(card()).getByText("UK · Series 3")).toBeTruthy();
  expect(await within(card()).findByText("34 · Dayton, Ohio · Teacher")).toBeTruthy();
  expect(within(card()).getByText("A teacher from Ohio who came to win.")).toBeTruthy();
  expect(api.getPlayer).toHaveBeenCalledWith("tuk", "p2");
  // At the head, the seat is a plain link to their page.
  expect(fireEvent.click(c)).toBe(true);
});

it("offers a crowded table as a list that picks the same way", () => {
  const onTap = vi.fn();
  render(<RoundTable roster={players(22)} kind="RT" season="tus-5" chosen={["p3"]} onTap={onTap} />);
  fireEvent.click(screen.getByRole("button", { name: "List" }));
  expect(screen.getByRole("button", { name: "List" }).getAttribute("aria-pressed")).toBe("true");
  const list = within(screen.getByRole("list", { name: "The round table vote" }));
  expect(list.getAllByRole("button")).toHaveLength(22);
  expect(list.getByRole("button", { name: "Player D, your first" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(list.getByRole("button", { name: "Player F" }));
  expect(onTap).toHaveBeenCalledWith("p5");
  fireEvent.click(screen.getByRole("button", { name: "Table" }));
  expect(screen.getByRole("group", { name: "The round table vote" })).toBeTruthy();
});

it("seats the cast with how each left, and the card says it for the one at the head", () => {
  const cast = [
    { id: "ava", name: "Ava Stone", headshot: null, faction: null, exit: null },
    { id: "ben", name: "Ben Hart", headshot: null, faction: "Traitor" as const, exit: { ep: 2, how: "banished" } },
  ];
  render(<RoundTable roster={cast} kind="RT" season="tus-5" chosen={[]} cast hrefOf={(id) => `/p/${id}`} label="Cast" />);
  const ben = screen.getByRole("link", { name: "Ben Hart, Traitor, Banished ep 2" });
  expect(ben.getAttribute("href")).toBe("/p/ben");
  expect(screen.getByRole("link", { name: "Ava Stone" })).toBeTruthy();
  fireEvent.click(ben);
  expect(within(card()).getByText("Traitor · Banished ep 2")).toBeTruthy();
});
