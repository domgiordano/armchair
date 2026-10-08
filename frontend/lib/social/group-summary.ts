import type { GroupDetail, GroupPerson } from "@armchair/app-core/api/groups";
import type { Leaderboard, Ranked } from "@/lib/api/leaderboard";

export interface WeekProgress {
  ep: number;
  week: number | null;
  rateable: number;
  done: GroupPerson[];
  started: GroupPerson[];
  waiting: GroupPerson[];
}

/** Who in the group has scored this week's whole show, who has started, and who hasn't. */
export function weekProgress(group: GroupDetail, board: Leaderboard): WeekProgress | null {
  const week = board.week;
  if (!week || week.rateable === 0) return null;
  const count = (m: GroupPerson) => week.answered[m.sub] ?? 0;
  return {
    ep: week.ep,
    week: week.week,
    rateable: week.rateable,
    done: group.members.filter((m) => count(m) >= week.rateable),
    started: group.members.filter((m) => count(m) > 0 && count(m) < week.rateable),
    waiting: group.members.filter((m) => count(m) === 0),
  };
}

export interface Joined {
  member: GroupPerson;
  at: string;
}

/** Newest joins first. The owner founding the group reads as its first join. */
export function joins(group: GroupDetail): Joined[] {
  return group.members
    .flatMap((member) => (member.joinedAt ? [{ member, at: member.joinedAt }] : []))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export interface Standing {
  leader: Ranked | null;
  /** Your place, or null below the dance floor. */
  rank: number | null;
  ranked: number;
}

export function standing(board: Leaderboard): Standing {
  return { leader: board.ranked[0] ?? null, rank: board.me.rank, ranked: board.ranked.length };
}

/** "Couch Judges'" for a name ending in s, "Office Pool's" otherwise. */
export const possessive = (name: string) => (/s$/i.test(name.trim()) ? `${name}'` : `${name}'s`);

const CODE = /^[A-Za-z0-9_-]{16}$/;

/** An invite code from whatever was pasted: the link (either host) or the bare code. */
export function inviteCode(pasted: string): string | null {
  const text = pasted.trim();
  if (CODE.test(text)) return text;
  try {
    const code = new URL(text).searchParams.get("code");
    return code && CODE.test(code) ? code : null;
  } catch {
    return null;
  }
}
