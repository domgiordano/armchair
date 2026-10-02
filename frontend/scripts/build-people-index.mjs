#!/usr/bin/env node
// Writes lib/search/people-index.json, every star, pro and judge in
// fixtures/seasons, so the search box can match them without a request. Same
// ids, roles and headshots as the PEOPLE#dwts rows backend/scripts/seed_season.py
// people() seeds from the same fixtures; keep the two in step.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SEASONS = new URL("../../fixtures/seasons/", import.meta.url);
const OUT = new URL("../lib/search/people-index.json", import.meta.url);
// A person who held two roles in one season is listed under the first of these.
const RANK = ["judge", "pro", "celebrity"];

/** backend/lambdas/common/people.py slug(). */
const slug = (name) =>
  name
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const seasons = readdirSync(SEASONS)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(new URL(f, SEASONS), "utf8")))
  .sort((a, b) => a.season - b.season);

const found = new Map();
const add = (id, member, season, role) => {
  const p = found.get(id) ?? { name: member.name, headshot: null, seen: [] };
  p.headshot ??= member.headshot?.image ?? null;
  p.seen.push({ season, role });
  found.set(id, p);
};

for (const s of seasons) {
  for (const c of s.contestants) {
    for (const m of c.members) add(m.role === "celebrity" ? c.id : slug(m.name), m, s.season, m.role);
  }
  for (const j of s.judges) add(j.id, j, s.season, "judge");
}

const people = [...found]
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([id, p]) => {
    const latest = p.seen.toSorted((a, b) => b.season - a.season || RANK.indexOf(a.role) - RANK.indexOf(b.role));
    return {
      id,
      name: p.name,
      roles: [...new Set(latest.map((e) => e.role))],
      headshot: p.headshot,
      seasons: [...new Set(p.seen.map((e) => e.season))].sort((a, b) => a - b),
    };
  });

writeFileSync(OUT, JSON.stringify(people));
console.log(`people index: ${people.length} people -> ${fileURLToPath(OUT)}`);
