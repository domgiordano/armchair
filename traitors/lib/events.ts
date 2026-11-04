import type { EpisodeEvent } from "@/lib/api/traitors";

/** An optional call whose night came and went with nobody recruited, and no pick of yours riding on it. */
export const nothingHappened = (e: EpisodeEvent) =>
  Boolean(e.optional) &&
  !e.locked &&
  e.type === "RECRUIT" &&
  e.result != null &&
  (e.result.recruits ?? []).length === 0 &&
  !e.mine?.picks;
