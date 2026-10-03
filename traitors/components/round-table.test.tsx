import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { RoundTable } from "./round-table";

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${String.fromCharCode(65 + i)}`, headshot: null }));

it("seats a dozen with no list toggle", () => {
  render(<RoundTable roster={players(12)} kind="MURDER" chosen={[]} onTap={vi.fn()} />);
  expect(within(screen.getByRole("group", { name: "Who is murdered" })).getAllByRole("button")).toHaveLength(12);
  expect(screen.queryByRole("button", { name: "List" })).toBeNull();
});

it("offers a crowded table as a list that picks the same way", () => {
  const onTap = vi.fn();
  render(<RoundTable roster={players(22)} kind="RT" chosen={["p3"]} onTap={onTap} />);
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

it("seats the cast with how each left, each seat a link to the player's page", () => {
  const cast = [
    { id: "ava", name: "Ava Stone", headshot: null, faction: null, exit: null },
    { id: "ben", name: "Ben Hart", headshot: null, faction: "Traitor" as const, exit: { ep: 2, how: "banished" } },
  ];
  render(<RoundTable roster={cast} kind="RT" chosen={[]} cast hrefOf={(id) => `/p/${id}`} label="Cast" />);
  const ben = screen.getByRole("link", { name: "Ben Hart, Traitor, Banished ep 2" });
  expect(ben.getAttribute("href")).toBe("/p/ben");
  // Chalked on the table in front of the seat.
  expect(within(screen.getByRole("group", { name: "Cast" })).getByText("Banished ep 2")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Ava Stone" })).toBeTruthy();
});
