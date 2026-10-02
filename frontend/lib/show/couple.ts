import type { Average, OpenRow, PerformanceRow, PersonPage, SeasonResult } from "@/lib/api/people";

export const paddle = (r: OpenRow) => (r.mine && "value" in r.mine ? r.mine.value : null);

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);

function pooled(groups: Average[]): Average {
  const count = groups.reduce((n, g) => n + g.count, 0);
  const total = groups.reduce((n, g) => n + (g.mean ?? 0) * g.count, 0);
  return { count, mean: count ? Math.round((total / count) * 100) / 100 : null };
}

export interface CoupleTotals {
  dances: number;
  /** Dances the gate still hides: the caller hasn't answered them. */
  locked: number;
  judges: number | null;
  judged: number;
  you: number | null;
  paddles: number;
  /** Your paddle minus the judges' mean, averaged over dances with both: positive is softer. */
  gap: number | null;
  friends: Average;
  everyone: Average;
  best: OpenRow | null;
  /** Only once there are two judged dances, or it would just be `best` again. */
  worst: OpenRow | null;
  favorite: OpenRow | null;
  /** The dance where your paddle and the judges' mean sat furthest apart. */
  split: OpenRow | null;
}

/** A couple's season in numbers, over the rows people_get returned for it. */
export function coupleTotals(rows: PerformanceRow[]): CoupleTotals {
  const open = rows.filter((r): r is OpenRow => !r.locked);
  const judged = open.filter((r) => r.panelMean !== null);
  const scored = open.filter((r) => paddle(r) !== null);
  const both = judged.filter((r) => paddle(r) !== null);
  const by = (pick: (r: OpenRow) => number) => (a: OpenRow, b: OpenRow) => pick(b) - pick(a) || a.ep - b.ep;
  const gap = (r: OpenRow) => (paddle(r) ?? 0) - (r.panelMean ?? 0);
  const byJudges = [...judged].sort(by((r) => r.panelMean ?? 0));
  return {
    dances: rows.length,
    locked: rows.length - open.length,
    judges: mean(judged.map((r) => r.panelMean ?? 0)),
    judged: judged.length,
    you: mean(scored.map((r) => paddle(r) ?? 0)),
    paddles: scored.length,
    gap: mean(both.map(gap)),
    friends: pooled(open.map((r) => r.friends)),
    everyone: pooled(open.map((r) => r.everyone)),
    best: byJudges[0] ?? null,
    worst: byJudges.length > 1 ? byJudges[byJudges.length - 1] : null,
    favorite: [...scored].sort(by((r) => paddle(r) ?? 0))[0] ?? null,
    split: [...both].sort(by((r) => Math.abs(gap(r))))[0] ?? null,
  };
}

/** The couple's result in `season`: null when the person never danced it. */
export function coupleResult(person: PersonPage, season: string): SeasonResult | null {
  return person.seasons.find((s) => s.season === season && s.role !== "judge")?.result ?? null;
}

/** "W3", or "Ep 6" for a night with no week. */
export const weekShort = (r: { ep: number; week: number | null }) => (r.week === null ? `Ep ${r.ep}` : `W${r.week}`);
