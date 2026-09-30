import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

interface SeasonFile {
  judges: { id: string }[];
  episodes: unknown[];
  contestants: unknown[];
}

export interface CatalogCounts {
  seasons: number;
  couples: number;
  episodes: number;
  judges: number;
}

// The same catalog seed_season.py loads into DynamoDB. Read when the static page
// is built, so the numbers on the landing are the ones the app actually has.
const DIR = path.join(process.cwd(), "..", "fixtures", "seasons");

export function catalogCounts(): CatalogCounts {
  const seasons = readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as SeasonFile);
  return {
    seasons: seasons.length,
    couples: seasons.reduce((n, s) => n + s.contestants.length, 0),
    episodes: seasons.reduce((n, s) => n + s.episodes.length, 0),
    judges: new Set(seasons.flatMap((s) => s.judges.map((j) => j.id))).size,
  };
}
