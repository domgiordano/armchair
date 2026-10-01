import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

interface SeasonFile {
  year: number;
  judges: { id: string }[];
  // Null on a season whose scores only the live cron has loaded so far.
  episodes: { performances?: { judges: (number | null)[] | null }[] | null }[];
  contestants: unknown[];
}

export interface CatalogCounts {
  seasons: number;
  couples: number;
  performances: number;
  judgeScores: number;
  firstYear: number;
  lastYear: number;
}

// The same catalog seed_season.py loads into DynamoDB. Read when the static page
// is built, so the numbers on the landing are the ones the app actually has.
const DIR = path.join(process.cwd(), "..", "fixtures", "seasons");

export function catalogCounts(): CatalogCounts {
  const seasons = readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as SeasonFile);
  const performances = seasons.flatMap((s) => s.episodes.flatMap((e) => e.performances ?? []));
  const years = seasons.map((s) => s.year);
  return {
    seasons: seasons.length,
    couples: seasons.reduce((n, s) => n + s.contestants.length, 0),
    performances: performances.length,
    judgeScores: performances.reduce((n, p) => n + (p.judges ?? []).filter((j) => j !== null).length, 0),
    firstYear: Math.min(...years),
    lastYear: Math.max(...years),
  };
}
