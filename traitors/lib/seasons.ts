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

const EDITION: Record<Show, string> = { tus: "US", tuk: "UK", tukc: "UK" };
const UNIT: Record<Show, string> = { tus: "Season", tuk: "Series", tukc: "Series" };

// Titles are Wikipedia page titles. Only a name of its own, like "The Traitors:
// New Blood", says more than the number; "...(American TV series) season 3" doesn't.
const PAGE_PREFIX = /^The (Celebrity )?Traitors\b(\s*\([^)]*\))?[:\s]*/;
const NUMBERED = /^(season|series)\s+\d+$/i;

export interface SeasonName {
  /** "New Blood", "Season 3", "Celebrity Traitors · Series 2". */
  title: string;
  /** What the title leaves out: "US · Season 5", or just "UK". */
  eyebrow: string;
  /** "Season 5" when the title is a name that doesn't say it, else null. */
  numbered: string | null;
}

export function seasonName(s: Pick<SeasonSummary, "id" | "number" | "title">): SeasonName {
  const show = showOf(s.id);
  const numbered = `${UNIT[show]} ${s.number}`;
  const name = s.title?.replace(PAGE_PREFIX, "").trim();
  if (name && !NUMBERED.test(name)) return { title: name, eyebrow: `${EDITION[show]} · ${numbered}`, numbered };
  return { title: show === "tukc" ? `Celebrity Traitors · ${numbered}` : numbered, eyebrow: EDITION[show], numbered: null };
}

/** The season's title on one line, for pickers and labels. */
export const seasonLabel = (s: Pick<SeasonSummary, "id" | "number" | "title">) => seasonName(s).title;

/** A season id's number: "tukc-2" is 2. */
export const seasonNumber = (id: string) => Number(id.split("-")[1]);

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
