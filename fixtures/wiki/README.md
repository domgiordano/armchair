# Wikipedia fixtures

Full-page wikitext of real revisions, fetched once by revision id and committed.
`backend/tests/test_wiki_parse.py` parses them and compares against
`fixtures/wiki-golden.json`.

The expected output is hand-transcribed from these files in
`backend/scripts/build_wiki_fixtures.py`, never produced by the parser, so a wrong
parser can't write its own answer key. A rebuild must leave the golden byte-identical
unless an expectation was deliberately changed.

| File | Page | Revision | Timestamp (UTC) | Cases |
|---|---|---|---|---|
| `s35-1377681547.wikitext` | season 35 | [1377681547][r1] | 2026-09-30 15:03:34 | wk1 two nights, wk2 and wk3 final, wk4 pre-show table, wk5-9 commented out |
| `s35-1377570871-vandal.wikitext` | season 35 | [1377570871][r2] | 2026-09-30 01:23:22 | wk3 vandal edit: Jenna & Val `30 (10, 10, 10)`, Connor `20 (7, 7, 6)` |
| `s35-1377571301-revert.wikitext` | season 35 | [1377571301][r3] | 2026-09-30 01:25:08 | wk3 revert of the above, mid-show with four rows empty |
| `s34-1375977389.wikitext` | season 34 | [1375977389][r4] | 2026-09-21 06:20:04 | wk1 2 judges, wk7 marathon bonus, wk8 team dances, wk9 4 judges + relay table, wk10 rowspan, wk11 Judge column |
| `s1-1375742773.wikitext` | season 1 | [1375742773][r5] | 2026-09-19 19:41:48 | wk4 group dance "No scores received" |
| `s8-1372835313.wikitext` | season 8 | [1372835313][r6] | 2026-09-02 14:26:37 | wk3 scored dance-off on the results show |
| `s15-1372836123.wikitext` | season 15 | [1372836123][r7] | 2026-09-02 14:31:53 | wk7 a column per judge, half points, marathon bonus |
| `s20-1375764332.wikitext` | season 20 | [1375764332][r8] | 2026-09-19 22:53:57 | wk9 `X` for a judge sitting out |
| `s31-1372832846.wikitext` | season 31 | [1372832846][r9] | 2026-09-02 14:11:18 | wk6 five judges, "given in this order" |

S34 uses 1375977389, a revert of vandalism, rather than the newer 1376084251, an
unreviewed edit by a temporary account.

Fetched with:

```bash
curl -sG -A "armchair/0.1 (https://github.com/domgiordano/armchair)" \
  https://en.wikipedia.org/w/api.php \
  --data-urlencode action=query --data-urlencode prop=revisions \
  --data-urlencode revids=1377681547 --data-urlencode "rvprop=ids|timestamp|content" \
  --data-urlencode rvslots=main --data-urlencode format=json --data-urlencode formatversion=2 \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['query']['pages'][0]['revisions'][0]['slots']['main']['content'], end='')" \
  > s35-1377681547.wikitext
```

## Attribution

The `.wikitext` files are text from the English Wikipedia articles
"Dancing with the Stars (American TV series) season N" for seasons
[1][wp1], [8][wp8], [15][wp15], [20][wp20], [31][wp31], [34][wp34] and [35][wp35], by their
contributors (full author lists are in each article's history). They are licensed
under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and are
reproduced unmodified at the revisions linked above.

[r1]: https://en.wikipedia.org/w/index.php?oldid=1377681547
[r2]: https://en.wikipedia.org/w/index.php?oldid=1377570871
[r3]: https://en.wikipedia.org/w/index.php?oldid=1377571301
[r4]: https://en.wikipedia.org/w/index.php?oldid=1375977389
[r5]: https://en.wikipedia.org/w/index.php?oldid=1375742773
[r6]: https://en.wikipedia.org/w/index.php?oldid=1372835313
[r7]: https://en.wikipedia.org/w/index.php?oldid=1372836123
[r8]: https://en.wikipedia.org/w/index.php?oldid=1375764332
[r9]: https://en.wikipedia.org/w/index.php?oldid=1372832846
[wp35]: https://en.wikipedia.org/w/index.php?title=Dancing_with_the_Stars_(American_TV_series)_season_35&action=history
[wp34]: https://en.wikipedia.org/w/index.php?title=Dancing_with_the_Stars_(American_TV_series)_season_34&action=history
[wp1]: https://en.wikipedia.org/w/index.php?title=Dancing_with_the_Stars_(American_TV_series)_season_1&action=history
[wp8]: https://en.wikipedia.org/w/index.php?title=Dancing_with_the_Stars_(American_TV_series)_season_8&action=history
[wp15]: https://en.wikipedia.org/w/index.php?title=Dancing_with_the_Stars_(American_TV_series)_season_15&action=history
[wp20]: https://en.wikipedia.org/w/index.php?title=Dancing_with_the_Stars_(American_TV_series)_season_20&action=history
[wp31]: https://en.wikipedia.org/w/index.php?title=Dancing_with_the_Stars_(American_TV_series)_season_31&action=history

## Traitors

`backend/tests/test_traitors_parse.py` parses these. Its expectations are written by hand in
the test: the banished player and Finish-cell episode, and the Vote row's counts. The parser's
per-player tally must reproduce those counts, so it can't grade itself.

| File | Page | Revision | Timestamp (UTC) | Cases |
|---|---|---|---|---|
| `traitors-us4-1376576846.wikitext` | US season 4 | [1376576846][t1] | 2026-09-25 01:25:49 | finished season, `(2x)` dagger, Secret Traitor, Ultimatum recruit, nicknames |
| `traitors-uk4-1374211799.wikitext` | UK series 4 | [1374211799][t2] | 2026-09-10 15:06:59 | footnote-only dagger, tie + revote + Fate (twice), one carried into the next episode |
| `traitors-ukc1-1378003069.wikitext` | Celebrity series 1 | [1378003069][t3] | 2026-10-02 11:06:02 | two round tables in one episode, solo winner |
| `traitors-ukc2-1378006453.wikitext` | Celebrity series 2 | [1378006453][t4] | 2026-10-02 11:35:18 | live season, no round table yet |
| `traitors-us5-1377883386.wikitext` | New Blood | [1377883386][t5] | 2026-10-01 18:55:42 | live season, `3/4` and `4/5` columns, pending round table, `{{void}}` episodes |
| `traitors-us5-1376587573.wikitext` | New Blood | [1376587573][t6] | 2026-09-25 02:29:44 | the first revision where episode 4's round table is complete |
| `traitors-us5-1376577733-partial.wikitext` | New Blood | [1376577733][t7] | 2026-09-25 01:35:26 | mid-episode: Arisa banished, 7 of 19 votes in, Vote row empty |
| `traitors-us5-1375764755-redirect.wikitext` | New Blood | [1375764755][t8] | 2026-09-19 22:57:43 | the page blanked to a redirect for 17 hours |
| `traitors-main-tus-1377133951.wikitext` | The Traitors (American TV series) | [1377133951][t9] | 2026-09-28 01:23:05 | season list: seasons 1-6, season 5 linked by a title that redirects to New Blood |
| `traitors-main-tuk-1377988096.wikitext` | The Traitors (British TV series) | [1377988096][t10] | 2026-10-02 08:07:32 | season list: series 1-4 |
| `traitors-main-tukc-1377995051.wikitext` | The Celebrity Traitors | [1377995051][t11] | 2026-10-02 09:46:14 | season list: series 1-2 |

`backend/tests/test_traitors_parse.py` checks the season lists against titles copied by hand
from each main article's Series overview.

These are text from the English Wikipedia articles "The Traitors (American TV series)
season 4", "The Traitors (British TV series) series 4", "The Celebrity Traitors series 1",
"The Celebrity Traitors series 2", "The Traitors: New Blood", "The Traitors (American TV
series)", "The Traitors (British TV series)" and "The Celebrity Traitors", by their
contributors (full author lists are in each article's history), licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and reproduced unmodified at
the revisions linked.

[t1]: https://en.wikipedia.org/w/index.php?oldid=1376576846
[t2]: https://en.wikipedia.org/w/index.php?oldid=1374211799
[t3]: https://en.wikipedia.org/w/index.php?oldid=1378003069
[t4]: https://en.wikipedia.org/w/index.php?oldid=1378006453
[t5]: https://en.wikipedia.org/w/index.php?oldid=1377883386
[t6]: https://en.wikipedia.org/w/index.php?oldid=1376587573
[t7]: https://en.wikipedia.org/w/index.php?oldid=1376577733
[t8]: https://en.wikipedia.org/w/index.php?oldid=1375764755
[t9]: https://en.wikipedia.org/w/index.php?oldid=1377133951
[t10]: https://en.wikipedia.org/w/index.php?oldid=1377988096
[t11]: https://en.wikipedia.org/w/index.php?oldid=1377995051
