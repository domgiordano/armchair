import type { Elimination, Performers } from "@/lib/api/couples";
import type { Overview } from "@/lib/api/overview";
import type { Member, Season } from "@/lib/api/show";

export interface RosterCouple {
  id: string;
  members: Member[];
  /** Only once the caller has finished the episode they went out on (overview_get, per the gate). */
  eliminated: Elimination | null;
  /** The judges' mean over the dances the caller has opened. */
  judges: number | null;
  /** Dances behind `judges`. */
  judged: number;
  /** Null until the caller has paddled one of their dances. */
  you: number | null;
  gap: number | null;
}

export type RosterSort = "judges" | "you" | "name";

export const ROSTER_SORTS: { value: RosterSort; label: string }[] = [
  { value: "judges", label: "Judges' average" },
  { value: "you", label: "Your average" },
  { value: "name", label: "Name" },
];

export const celebrity = (c: { members: Member[] }) => c.members.find((m) => m.role === "celebrity") ?? c.members[0];

/**
 * Every couple on the season's public roster, with what the caller may see of
 * them. A couple overview_get leaves out (bad catalog data) still shows, bare.
 */
export function roster(season: Season, overview: Overview, performers: Performers): RosterCouple[] {
  const standing = new Map(overview.couples.map((c) => [c.id, c]));
  const yours = new Map(performers.couples.map((c) => [c.id, c]));
  return season.contestants.map((c) => {
    const s = standing.get(c.id);
    const p = yours.get(c.id);
    return {
      id: c.id,
      members: c.members,
      eliminated: s?.eliminated ?? null,
      judges: s?.average ?? null,
      judged: s?.dances ?? 0,
      you: p?.you ?? null,
      gap: p?.gap ?? null,
    };
  });
}

const byName = (a: RosterCouple, b: RosterCouple) => celebrity(a).name.localeCompare(celebrity(b).name);

/**
 * Still dancing first, in `by` order with no-number couples last by name;
 * then the eliminated, most recently out first. Without `showOut`, only the first part.
 */
export function rosterOrder(couples: RosterCouple[], by: RosterSort, showOut: boolean): RosterCouple[] {
  const pick = (c: RosterCouple) => (by === "judges" ? c.judges : by === "you" ? c.you : null);
  const dancing = couples
    .filter((c) => !c.eliminated)
    .sort((a, b) => {
      const x = pick(a);
      const y = pick(b);
      if (x === null || y === null) return x === y ? byName(a, b) : x === null ? 1 : -1;
      return y - x || byName(a, b);
    });
  if (!showOut) return dancing;
  const out = couples.filter((c) => c.eliminated).sort((a, b) => (b.eliminated?.ep ?? 0) - (a.eliminated?.ep ?? 0) || byName(a, b));
  return [...dancing, ...out];
}

const one = (n: number) => n.toFixed(1);

/** What the caller can see of a couple's scores, or why not yet. */
export function scoreLine(c: RosterCouple, season: Season, aired: boolean): string {
  const parts = [c.judges !== null && `Judges ${one(c.judges)}`, c.you !== null && `You ${one(c.you)}`].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  if (!aired) return "No dances yet";
  return season.open ? "No judges' scores on record" : "Score to see the judges' marks";
}

/** A couple still in it: dancing now, or a finalist once the season is over. */
export const placeLabel = (c: RosterCouple, season: Season) => (c.eliminated ? null : season.open ? "Finalist" : "Dancing");
