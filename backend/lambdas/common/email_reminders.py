"""
The two reminder emails, as jobs for mailer.run_jobs:

- tonight: LEAD before an episode airs (DWTS) or releases (Traitors; a night
  with several episodes is one email), to everyone who plays the show.
- closing: DWTS only, inside CLOSING_DAYS of the active episode's window
  closing (common/window.py), to players who haven't answered every dance in
  it. Traitors picks never lock on a clock, so it has no closing reminder.

The sent log makes every tick idempotent, so a job only has to be due, not new.
"""

from __future__ import annotations

import math
import os
from datetime import datetime, timedelta

from lambdas.common.email_shows import Dwts, Traitors, clock
from lambdas.common.episodes_dynamo import performances
from lambdas.common.gate import answered, rateable
from lambdas.common.mailer import Job
from lambdas.common.window import active

LEAD = timedelta(hours=2)
DAY = timedelta(days=1)


def tonight(season: Dwts | Traitors, now: datetime) -> list[Job]:
    if isinstance(season, Dwts):
        due = [[n] for n, t in season.airs.items() if t and now < t <= now + LEAD]
        start = season.airs
        verb, label = "score", lambda eps: season.label(eps[0])
    else:
        due = [eps for eps in season.nights() if now < season.releases[eps[0]] <= now + LEAD]
        start = season.releases
        verb, label = "pick", season.label
    if not due:
        return []
    readers = season.players()
    jobs = []
    for eps in due:
        ctx = {
            "label": label(eps),
            "when": clock(start[eps[0]], season.tz),
            "verb": verb,
            "url": season.url(eps[0]),
        }
        event = f"{season.id}#{eps[0]:02d}"
        jobs.append(Job(season.show, "tonight", event, dict.fromkeys(readers, ctx)))
    return jobs


def closing(season: Dwts, now: datetime) -> list[Job]:
    ep = active(season.meta, season.spans, now)
    if ep is None:
        return []
    left = season.spans[ep][1] - now
    if not timedelta(0) < left <= int(os.environ.get("CLOSING_DAYS", "2")) * DAY:
        return []
    keys = set(rateable(ep, season.episodes[ep], season.contestants, performances(season.pk(ep))))
    scores = season.scores([ep])[ep]
    readers = {}
    for sub in season.players():
        done = len(keys & answered(sub, scores))
        if done < len(keys):
            readers[sub] = {
                "label": season.label(ep),
                "days": math.ceil(left / DAY),
                "answered": done,
                "rateable": len(keys),
                "url": season.url(ep),
            }
    return [Job("dwts", "closing", f"{season.id}#{ep:02d}", readers)] if readers else []
