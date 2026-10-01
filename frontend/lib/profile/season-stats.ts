/** The judge whose scores you track most closely, by mean gap. */
export function closestJudge(judges: Record<string, { mae: number }>): string | null {
  const ranked = Object.entries(judges).sort(([, a], [, b]) => a.mae - b.mae);
  return ranked.length > 0 ? ranked[0][0] : null;
}
