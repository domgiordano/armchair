# Favorites to win (odds board)

Status: Ready (built in this branch)

Each contestant's odds to win the season, sportsbook style: American odds with the
implied chance, favorite first, movement against the previous episode, and short
"why" chips. DWTS on the home overview; Traitors on the overview and the winner-bet
screen.

## Sources (checked 2026-10-08)

| Source | DWTS S35 | Traitors | Automated use |
|---|---|---|---|
| Polymarket Gamma API (`gamma-api.polymarket.com/events?slug=...`) | Live winner market | None for current seasons | Used. Public, no key; `polymarket.com/robots.txt` allows all; its `llms.txt` asks quoters to cite the market page and the read time, which the board does. The full Terms of Use render client-side and could not be read: confirm before relying on it. |
| Kalshi API | Live winner market | None | Not used. Developer Agreement limits API use to a member's own trading and bars storing data. |
| Oddschecker | No market | Celebrity Traitors S2 winner market | Not used. Bot-blocked (403), ToS unreadable. Link only. |
| DraftKings / FanDuel / BetMGM | US books don't price reality TV | — | — |
| Offshore books (Bovada, BetOnline) | Quoted second-hand only | — | Not used: unlicensed. |
| Gold Derby | No S35 page | — | Not used: pay-per-crawl for bots. |
| Wikipedia (MediaWiki API) | Judges' scores, eliminations; no bottom-two data | Exits, votes | Already ingested by the pollers; CC BY-SA. |

A market is listed per season in `common/polymarket.py` `MARKETS`. Removing the entry
turns market odds off for that season; the board falls back to the model.

## Model (`common/favorites.py`)

Published odds win where a market exists (`MARKET_WEIGHT = 1.0`), renormalized over the
contestants still on the board. The model prices everyone the market doesn't list, and
the whole board when there is no market, labelled "Armchair odds (model)". Both are
returned per entry so the UI can show the model beside the market.

DWTS strength, as z-scores across couples still in:
- judges' season average per dance (1.0), last episode's average (0.5), trend over the
  last three episodes (0.3), our crowd's average score (0.6)
- +0.25 per night in the judges' bottom two survived: the fan vote carried them. True
  bottom-two (jeopardy) data isn't published anywhere we can read.

Traitors strength:
- our crowd's winner bets, each bet split across its picks (1.0)
- round-table first votes received, the last two round tables doubled (-0.6)
- share of our crowd who picked them to be banished at the latest round table (-0.4)
- +0.2 per shield held
- Factions are never read: a current season hides them until a banishment the caller
  has seen, so the board can't lean on them either.

Chance = softmax(1.2 x strength). Odds are American, rounded to 5.

## Spoiler rules

- Snapshot `n` (`armchair-favorites`, `FAV#{show}#{season}` / `EP#{nn}`) reads nothing
  from a later episode: eliminations and exits cut at `n`, and any score, pick or bet
  submitted at or after episode `n + 1` starts is dropped.
- `cron_favorites` (every 15 minutes) rewrites only the newest episode out; older ones
  are written once if missing. So a market price in snapshot `n` was captured before
  `n + 1` started, and the board a viewer behind sees never changes under them.
- `favorites_get` serves the snapshot for the caller's last revealed episode, counting
  episodes in order: DWTS by `gate.results_open`, Traitors by `traitors_gate.seen`. A
  couple out in an unrevealed episode stays on the board at its old odds. Movement is
  against the snapshot before the one served.
- A market price captured at or after the next episode started is dropped at read time
  too (`for_viewer`), whatever snapshot it sits in.
- `through` lowers the episode further for dances answered but sealed on the device.
