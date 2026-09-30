import type { Dance } from "@/lib/api/stats";

export interface Bar {
  label: string;
  value: number;
  count: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Mean gap per dance style, closest first. A dance with no style reads as "Other". */
export function byStyle(dances: Dance[]): Bar[] {
  const groups = new Map<string, number[]>();
  for (const d of dances) {
    const style = d.style ?? "Other";
    groups.set(style, [...(groups.get(style) ?? []), d.error]);
  }
  return [...groups]
    .map(([label, errs]) => ({ label, value: Math.round(mean(errs) * 100) / 100, count: errs.length }))
    .sort((a, b) => a.value - b.value || b.count - a.count);
}

/**
 * Share of your paddles and of the judges' individual scores at each value
 * 1-10, over the same dances. Shares rather than counts, since three or four
 * judges score every dance you score once.
 */
export function distribution(dances: Dance[]): { value: number; mine: number; judges: number }[] {
  const judgeScores = dances.flatMap((d) => Object.values(d.judges));
  const share = (xs: number[], v: number) => (xs.length ? xs.filter((x) => x === v).length / xs.length : 0);
  const paddles = dances.map((d) => d.paddle);
  return Array.from({ length: 10 }, (_, i) => ({
    value: i + 1,
    mine: share(paddles, i + 1),
    judges: share(judgeScores, i + 1),
  }));
}

/**
 * Up to n dances you called closest and n furthest. With few dances the two
 * split the set, closest taking the odd one, so neither list is empty while
 * the other hoards; a dead-on call is never a miss.
 */
export function extremes(dances: Dance[], n = 3): { closest: Dance[]; furthest: Dance[] } {
  const sorted = [...dances].sort((a, b) => a.error - b.error || b.ep - a.ep);
  const closest = sorted.slice(0, Math.min(n, Math.ceil(sorted.length / 2)));
  const furthest = sorted
    .slice(closest.length)
    .reverse()
    .filter((d) => d.error > 0)
    .slice(0, n);
  return { closest, furthest };
}
