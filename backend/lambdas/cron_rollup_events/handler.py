"""
EventBridge Scheduler, daily at 00:30 UTC: roll the last two UTC days of activity
events into one ROLLUP item each (common/events_dynamo.py rollup()). Rewriting a
day is idempotent, so the second day only catches events that landed late.

Invoke with {"days": 30} to rebuild that many days back, yesterday first.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from lambdas.common import events_dynamo as events
from lambdas.common.logger import get_logger

log = get_logger(__file__)


def handler(event, context):
    days = int((event or {}).get("days") or 2)
    today = datetime.now(UTC).date()
    out = {}
    for back in range(1, days + 1):
        day = (today - timedelta(days=back)).isoformat()
        item = events.save_rollup(day)
        out[day] = {"events": item["events"], "users": len(item["users"])}
    log.info("rolled up %s", out)
    return out
