"""
POST /admin/order - set a night's running order by hand, before the show. Admins only.

Body: {"season": "dwts-35", "ep": "06", "keys": [every dance key of the night, in
order]}. The order outranks the page's until the show starts scoring
(cron_poll_wiki.settle), which then takes over; once it has, this is 409. The
page's dances and songs keep coming in either way.
"""

from __future__ import annotations

from datetime import UTC, datetime

from lambdas.common import events_dynamo
from lambdas.common.admins import require_admin
from lambdas.common.api import ConflictError, ValidationError, api_handler, body, ok
from lambdas.common.dynamo import update
from lambdas.common.episodes_dynamo import ref
from lambdas.common.lineup import night


@api_handler("admin_order")
def handler(event, context):
    admin = require_admin(event)
    data = body(event)
    show, season, ep = ref(data)
    episode, dances = night(show, season, ep)
    if episode.get("orderSource") == "live":
        raise ConflictError("The live show has set this order")
    keys = data.get("keys")
    known = [d["key"] for d in dances]
    if not isinstance(keys, list) or sorted(keys) != sorted(known):
        raise ValidationError(
            "keys must list every dance of the night once", field="keys", known=known
        )

    by_key = {d["key"]: d for d in dances}
    lineup = {
        k: {"order": i, "style": by_key[k]["style"], "song": by_key[k]["song"]}
        for i, k in enumerate(keys, start=1)
    }
    values = {
        "lineup": lineup,
        "runningOrder": True,
        "orderSource": "admin",
        "orderAt": datetime.now(UTC).isoformat(timespec="seconds"),
    }
    update("CATALOG_TABLE", {"pk": f"SEASON#{show}#{season}", "sk": episode["sk"]}, values)
    events_dynamo.audit(
        admin,
        "running-order",
        f"{show}-{season}/{ep}",
        "Running order set by hand",
        [d["key"] for d in dances if d["order"] is not None],
        keys,
    )
    return ok({"ep": ep, **values})
