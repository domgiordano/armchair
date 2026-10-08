// Breakdowns of one person's season from /traitors/record. Only calls with points count
// toward accuracy and head-to-head: those have a confirmed result.

import type { EventType, RecordCall } from "@/lib/api/traitors";

export interface Picked {
  player: string;
  count: number;
  /** How often by event: the round table counts every place on the slate. */
  by: Partial<Record<EventType, number>>;
}

/** Who someone picks most, across every call: "who I usually choose". */
export function mostPicked(calls: RecordCall[]): Picked[] {
  const tally = new Map<string, Picked>();
  for (const c of calls) {
    for (const p of c.picks ?? []) {
      const row = tally.get(p) ?? { player: p, count: 0, by: {} };
      row.count += 1;
      row.by[c.type] = (row.by[c.type] ?? 0) + 1;
      tally.set(p, row);
    }
  }
  return [...tally.values()].sort((a, b) => b.count - a.count || a.player.localeCompare(b.player));
}

export interface Rate {
  hits: number;
  of: number;
}

export interface Accuracy {
  /** Your I was the one banished. */
  banish: Rate;
  /** Places on your slate that landed in the top 3, right place or not. */
  top3: Rate;
  murder: Rate;
  recruit: Rate;
}

const rate = (hits: number, of: number): Rate => ({ hits, of });

/** Hit rates by decision. A night where nobody was murdered or recruited counts for neither. */
export function accuracy(calls: RecordCall[]): Accuracy {
  const scored = calls.filter((c) => c.calls);
  const rts = scored.filter((c) => c.type === "RT");
  const slots = rts.flatMap((c) => c.calls ?? []);
  const night = (type: EventType) => {
    const decided = scored.filter((c) => c.type === type && c.calls?.[0]?.why !== "void");
    return rate(decided.filter((c) => c.calls?.[0]?.why === "hit").length, decided.length);
  };
  return {
    banish: rate(rts.filter((c) => c.calls?.[0]?.why === "banished").length, rts.length),
    top3: rate(slots.filter((s) => s.why !== "miss").length, slots.length),
    murder: night("MURDER"),
    recruit: night("RECRUIT"),
  };
}

export const percent = (r: Rate) => (r.of ? Math.round((r.hits / r.of) * 100) : null);

export const total = (calls: RecordCall[]) => calls.reduce((sum, c) => sum + (c.points ?? 0), 0);

/** Points each episode and the running total, over `eps`. */
export function pointsOverTime(calls: RecordCall[], eps: number[]): { ep: number; points: number; total: number }[] {
  let running = 0;
  return eps.map((ep) => {
    const points = total(calls.filter((c) => c.ep === ep));
    running += points;
    return { ep, points, total: running };
  });
}

export interface HeadToHead {
  wins: number;
  losses: number;
  ties: number;
  /** Your points minus theirs over the calls you both scored. */
  margin: number;
}

/** You against them on every event you both called and that has a result. */
export function headToHead(mine: RecordCall[], theirs: RecordCall[]): HeadToHead {
  const key = (c: RecordCall) => `${c.ep}|${c.type}`;
  const them = new Map(theirs.filter((c) => c.points !== undefined).map((c) => [key(c), c.points ?? 0]));
  const out = { wins: 0, losses: 0, ties: 0, margin: 0 };
  for (const c of mine) {
    const other = them.get(key(c));
    if (c.points === undefined || other === undefined) continue;
    if (c.points > other) out.wins += 1;
    else if (c.points < other) out.losses += 1;
    else out.ties += 1;
    out.margin += c.points - other;
  }
  return out;
}
