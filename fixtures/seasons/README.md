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

## Headshots

`headshot.file` is picked by hand from Wikimedia Commons. `author`, `license` and
`sourceUrl` come from the file's Commons metadata:

```bash
cd backend && python scripts/seed_season.py --credits
```

Set to `null` on purpose, although the article has a page image:

- Guillermo Rodriguez: the Commons description names Guillermo Díaz. Needs an eyeball check.
- Daniella Karagach: the only free photo is a two-person dance shot.

`seed_season.py --headshots <site-bucket>` copies a 400px Commons thumbnail of each
file to `s3://<site-bucket>/headshots/<file>`.
