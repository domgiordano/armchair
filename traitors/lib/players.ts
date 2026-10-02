import type { Player } from "@/lib/api/traitors";

/** A player's name from a roster, or from their id, which is their name slugged. */
export function nameOf(id: string, players: Player[] | null): string {
  return players?.find((p) => p.id === id)?.name ?? id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0];

const NUMERALS: [number, string][] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** Episode numbers on the gilt plaques: 1-39 is all a season needs. */
export function roman(n: number): string {
  let out = "";
  for (const [value, mark] of NUMERALS) {
    while (n >= value) {
      out += mark;
      n -= value;
    }
  }
  return out;
}
