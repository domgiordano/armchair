import type { BoardColumn, BoardRow, CoupleStats } from "@/lib/api/couples";

export type CoupleSort = "you" | "judges" | "over" | "under" | "friends" | "everyone" | "dances";

export const COUPLE_SORTS: { value: CoupleSort; label: string }[] = [
  { value: "you", label: "Your average" },
  { value: "judges", label: "Judges' average" },
  { value: "over", label: "You score higher" },
  { value: "under", label: "You score lower" },
  { value: "friends", label: "Friends' average" },
  { value: "everyone", label: "Everyone's average" },
  { value: "dances", label: "Dances scored" },
];

const PICK: Record<CoupleSort, (c: CoupleStats) => number | null> = {
  you: (c) => c.you,
  judges: (c) => c.judges,
  over: (c) => c.gap,
  under: (c) => (c.gap === null ? null : -c.gap),
  friends: (c) => c.friends.mean,
  everyone: (c) => c.everyone.mean,
  dances: (c) => c.dances,
};

/** Highest first; a couple with no number for the sort goes last, by your average. */
export function sortCouples(couples: CoupleStats[], by: CoupleSort): CoupleStats[] {
  const pick = PICK[by];
  return [...couples].sort((a, b) => {
    const x = pick(a);
    const y = pick(b);
    if (x === null || y === null) return x === y ? b.you - a.you : x === null ? 1 : -1;
    return y - x || b.you - a.you;
  });
}

export type GapTone = "over" | "under" | "level";

/** Within a quarter point of the judges reads as level. */
export function gapTone(gap: number | null): GapTone {
  if (gap === null || Math.abs(gap) < 0.25) return "level";
  return gap > 0 ? "over" : "under";
}

/** One decimal with its sign; anything that rounds to zero reads "0.0", never "−0.0". */
export function signed(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)}`;
}

/** Ranked by one column, unranked rows last in the server's order. */
export function boardOrder(rows: BoardRow[], by: BoardColumn): BoardRow[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.ranks[by] ?? Infinity) - (b.r.ranks[by] ?? Infinity) || a.i - b.i)
    .map(({ r }) => r);
}

/** What a ranking is compared against: the judges, or your own when the judges are the ranking. */
export const baseline = (by: BoardColumn): BoardColumn => (by === "judges" ? "you" : "judges");

/** Places gained against the baseline: positive means higher here than there. */
export function movement(row: BoardRow, by: BoardColumn): number | null {
  const here = row.ranks[by];
  const there = row.ranks[baseline(by)];
  return here === null || there === null ? null : there - here;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}
