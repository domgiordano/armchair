export type Show = "tus" | "tuk" | "tukc";
export type Edition = "us" | "uk";

export interface SeasonSummary {
  id: string;
  number: number;
  year: number;
  current: boolean;
  title?: string | null;
}

/** UK lists the celebrity series beside the civilian one: they're numbered independently. */
export const EDITIONS: Record<Edition, Show[]> = { us: ["tus"], uk: ["tukc", "tuk"] };

const SEASON_ID = /^(tus|tukc|tuk)-\d{1,3}$/;

export const isSeasonId = (id: string | null): id is string => id !== null && SEASON_ID.test(id);

export const showOf = (id: string) => id.split("-")[0] as Show;

export const isShow = (s: string | null): s is Show => s === "tus" || s === "tuk" || s === "tukc";

export const editionOf = (id: string): Edition => (showOf(id) === "tus" ? "us" : "uk");

const NAMES: Record<Show, string> = { tus: "Season", tuk: "Series", tukc: "Celebrity" };

// Titles are Wikipedia page titles. Only a name of its own, like "The Traitors:
// New Blood", says more than the number; "...(American TV series) season 3" doesn't.
const PAGE_PREFIX = /^The (Celebrity )?Traitors\b(\s*\([^)]*\))?[:\s]*/;
const NUMBERED = /^(season|series)\s+\d+$/i;

export function seasonLabel(s: Pick<SeasonSummary, "id" | "number" | "title">): string {
  const base = `${NAMES[showOf(s.id)]} ${s.number}`;
  const name = s.title?.replace(PAGE_PREFIX, "").trim();
  return name && !NUMBERED.test(name) ? `${base} · ${name}` : base;
}

/** An edition's seasons, live ones first, then newest. */
export function mergeSeasons(lists: SeasonSummary[][]): SeasonSummary[] {
  return lists.flat().sort((a, b) => Number(b.current) - Number(a.current) || b.year - a.year || b.number - a.number);
}

/** The season asked for in the URL, else the edition's live one, else its newest. */
export function pickSeason(asked: string | null, seasons: SeasonSummary[]): string | null {
  if (isSeasonId(asked)) return asked;
  return seasons[0]?.id ?? null;
}

/** `href` carrying the season, keeping any query it already has. */
export function withSeason(href: string, season: string): string {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("season", season);
  return `${path}?${params}`;
}
