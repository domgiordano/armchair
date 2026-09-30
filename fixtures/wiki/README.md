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
