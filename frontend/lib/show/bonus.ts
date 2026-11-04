import type { EpisodeResults, Segment } from "@/lib/api/show";

export type BonusRow = Omit<Segment, "label">;

export interface BonusGroup {
  label: string;
  rows: BonusRow[];
}

// Most points first, which is a marathon's finishing order; rows without points keep the page's order.
const byPoints = (a: BonusRow, b: BonusRow) => (b.points ?? -1) - (a.points ?? -1);

/**
 * The night's extras, one list per marathon or dance-off. A season seeded before
 * segments has only the per-couple `bonus`, shown as one "Bonus points" list.
 */
export function bonusGroups(results: EpisodeResults): BonusGroup[] {
  if (results.segments?.length) {
    const groups = new Map<string, BonusRow[]>();
    for (const { label, ...row } of results.segments) groups.set(label, [...(groups.get(label) ?? []), row]);
    return [...groups].map(([label, rows]) => ({ label, rows: rows.sort(byPoints) }));
  }
  const rows = Object.entries(results.bonus).map(([id, points]) => ({ contestants: [id], points, text: null }));
  return rows.length ? [{ label: "Bonus points", rows: rows.sort(byPoints) }] : [];
}
