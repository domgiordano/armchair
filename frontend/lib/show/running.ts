import type { Card, Contestant } from "@/lib/api/show";
import { fold, rank } from "@/lib/search/match";

export type Cue = "first" | "on" | "next";

export const CUE_LABEL: Record<Cue, string> = { first: "Up first", on: "On now", next: "Up next" };

/**
 * While the show airs: the first dance the judges haven't scored is on now,
 * the one after it up next. `danced` counts the scored ones from the top of
 * the running order. Before any is scored, the first is up first.
 */
export function cues(cards: Card[], danced: number): Map<string, Cue> {
  const out = new Map<string, Cue>();
  const now = cards[danced];
  if (!now) return out;
  if (danced === 0) return out.set(now.key, "first");
  out.set(now.key, "on");
  if (cards[danced + 1]) out.set(cards[danced + 1].key, "next");
  return out;
}

/** The cards with a celebrity or pro matching `q`, in their order; every card for an empty query. */
export function findCards(cards: Card[], q: string, contestants: Map<string, Contestant>): Card[] {
  const folded = fold(q);
  if (!folded) return cards;
  return cards.filter((c) =>
    c.contestants.some((id) => (contestants.get(id)?.members ?? []).some((m) => rank(m.name, folded) !== null)),
  );
}
