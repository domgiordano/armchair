// The same rules as backend/lambdas/common/points.py, which decides the real score.
// See docs/features/traitors/PLAN.md, "Points".

export const WINNER = 20;
export const FACTION = 10;

/** A bet before the premiere is worth everything; each episode out takes a share off. */
export const multiplier = (episodes: number, released: number) => (episodes ? (episodes - released) / episodes : 0);
