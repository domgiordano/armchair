import type { ProfileDance } from "@/lib/api/profile";

export interface StyleAccuracy {
  style: string;
  count: number;
  mae: number;
}

export interface ScoreCount {
  score: number;
  you: number;
  judges: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Mean gap per dance style, closest first. Dances with no style yet are left out. */
export function byStyle(dances: ProfileDance[]): StyleAccuracy[] {
  const groups = new Map<string, number[]>();
  for (const d of dances) {
    if (!d.style) continue;
    groups.set(d.style, [...(groups.get(d.style) ?? []), d.error]);
  }
  return [...groups]
    .map(([style, errors]) => ({ style, count: errors.length, mae: mean(errors) }))
    .sort((a, b) => a.mae - b.mae || b.count - a.count || a.style.localeCompare(b.style));
}

/** How often each paddle 1-10 came up, beside the judges' average rounded to a whole paddle. */
export function distribution(dances: ProfileDance[]): ScoreCount[] {
  return Array.from({ length: 10 }, (_, i) => {
    const score = i + 1;
    return {
      score,
      you: dances.filter((d) => d.paddle === score).length,
      judges: dances.filter((d) => Math.round(d.panelMean) === score).length,
    };
  });
}

/** The dance you landed closest to the judges on, and the one furthest off. Earliest wins a tie. */
export function calls(dances: ProfileDance[]): { best: ProfileDance; worst: ProfileDance } | null {
  if (dances.length === 0) return null;
  let best = dances[0];
  let worst = dances[0];
  for (const d of dances) {
    if (d.error < best.error) best = d;
    if (d.error > worst.error) worst = d;
  }
  return { best, worst };
}

/** The judge whose scores you track most closely, by mean gap. */
export function closestJudge(judges: Record<string, { mae: number }>): string | null {
  const ranked = Object.entries(judges).sort(([, a], [, b]) => a.mae - b.mae);
  return ranked.length > 0 ? ranked[0][0] : null;
}
