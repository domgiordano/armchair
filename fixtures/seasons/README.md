# Season catalogs

One JSON file per season, loaded by `backend/scripts/seed_season.py` into the
`catalog` table. Public show facts only.

## dwts-35.json

- Roster, pros, judges, episode dates and themes: the Wikipedia S35 article at
  revision [1377681547](https://en.wikipedia.org/w/index.php?oldid=1377681547)
  (2026-09-30), cross-checked against `docs/features/dwts-companion/RESEARCH.md`.
- `ep` is the broadcast episode, not the week. The premiere is episodes 1 and 2,
  both week 1, so the season has 12 episodes over 11 weeks.
- `aliases` are the celebrity half of the Weekly scores row headers ("Connor W."),
  which `wiki_parse.resolve` looks up. `test_seed_season.py` checks them against
  the parser's golden aliases.
- `start`/`end` are local times in `America/New_York`. RESEARCH verified the
  8-10 pm runtime for 9/29 only.
- `null` means unknown, never "none": `panel` and `dancesPerCouple` for weeks 5-11
  (guest judges and multi-dance weeks are unannounced), and headshots with no
  usable Commons photo.
- `eliminatedEp` is set for couples already out, by episode number.
- `rateableKeys` on episodes 1 and 2 splits the premiere by night, from the
  "Week 1 (Night 1)" and "(Night 2)" score tables. Without it the gate asks for
  every couple still in on both nights.

## Headshots

Every person's `headshot` is copied from `fixtures/headshots.json`, which maps each name
as the fixtures spell it to a free Wikimedia Commons file and its credit, or to `null`
when none was found. `backend/scripts/find_headshots.py` fills it: Wikidata's image for
the person's article, the article's free lead image, then the person's Commons category
and a strict Commons search. It only looks up names the registry doesn't have yet, and
`test_find_headshots.py` checks every fixture against the registry.

```bash
cd backend && python scripts/find_headshots.py           # new names, then every fixture
cd backend && python scripts/find_headshots.py --apply   # copy the registry into fixtures only
```

To retry a `null`, delete its entry and run the script. Hand decisions live in the
script: `SKIP` keeps a person null (Guillermo Rodriguez, Daniella Karagach), `REJECT`
rules out a file that passes every check but shows no face. Network and studio
photos, signatures and graves are refused by rule.

`seed_season.py all --headshots <site-bucket>` copies a 400px Commons thumbnail of each
file not already under `s3://<site-bucket>/headshots/<file>`.

## dwts-1.json to dwts-34.json

Built by `backend/scripts/build_season.py` from one Wikipedia revision per season,
recorded as `revid`/`revTimestamp`. Re-running the script rebuilds from that revision
unless `--latest` or `--revid` is given. Nothing is edited by hand.

Beyond the dwts-35 shape:

- `year`, `current` (false; dwts-35 is the season the app opens on).
- Each episode is one scored night: `week`, `night`, `theme` (the week heading),
  `panel` (judge ids), `rateableKeys` (`<cid>#<n>`, the solo dances a user answers),
  and `performances` with every judge's value confirmed. A performance lists its own
  `panel` only when a different panel scored it (S11 week 7's team dances).
- `judges` values are in `panel` order; `null` is a judge who sat the dance out (S20 week 9 `X`).
- `airDate` is null where the page doesn't pin it down (S11 and S12 list no dates).
  `start`/`end` are null: the page has no times.
- `eliminatedEp` is the episode of a couple's last scored dance when the Cast table
  says Eliminated or Withdrew; finalists have none.
- `skipped` lists every row left out and why: "No scores received" group dances,
  couples missing from the Cast table, values that don't fit the panel.
- Headshots come from `fixtures/headshots.json`, like dwts-35's.
- S10 and S11 week 4 gave each dance a technical and a performance score; they load
  as dance 1 and dance 2 of the same routine.

The past-season files are facts read from the English Wikipedia articles
"Dancing with the Stars (American TV series) season N" at the revision each file
records, which are licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
S34 is pinned to 1375977389, not the newer unreviewed 1376084251 (see fixtures/wiki/README.md).

## Which season is current

Each file's `current` flag is copied to its `SEASONS#dwts` / `SEASON#<nnn>` index item
(`id`, `number`, `year`, `current`), which `GET /seasons/list` returns for the season
picker. Exactly one fixture has `current: true`, today dwts-35. When S36 starts, flip
dwts-35 to false, add dwts-36 with true, and run Seed Season with `all`.
