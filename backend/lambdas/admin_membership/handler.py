"""
POST /admin/membership - fix someone's place in a group. Admins only.

Body: {"sub": <user>, "group": <gid>, "action": ..., "reason": str}
- add: puts them in, or completes a half-written join; clears a pending invite or request
- remove: takes them out; the owner can't be removed, they delete or hand over the group
- repair: add, or drops their link when the group itself is gone
- resend: a fresh invite from the owner, with a new notification
Logged with their membership before and after.
"""

from __future__ import annotations

from lambdas.common import events_dynamo, groups_dynamo
from lambdas.common.admins import reason, require_admin, target
from lambdas.common.api import ValidationError, api_handler, body, ok
from lambdas.common.dynamo import table

ACTIONS = ("add", "remove", "repair", "resend")


def state(gid: str, sub: str) -> dict:
    tbl = table("GROUPS_TABLE")

    def has(pk: str, sk: str) -> bool:
        return "Item" in tbl.get_item(Key={"pk": pk, "sk": sk}, ConsistentRead=True)

    return {
        "member": has(f"GROUP#{gid}", f"MEMBER#{sub}"),
        "linked": has(f"USER#{sub}", f"GROUP#{gid}"),
        "invited": has(f"GROUP#{gid}", f"INVITED#{sub}"),
    }


@api_handler("admin_membership")
def handler(event, context):
    admin = require_admin(event)
    data = body(event)
    sub, gid, why = target(data), groups_dynamo.ref(data), reason(data)
    action = data.get("action")
    if action not in ACTIONS:
        raise ValidationError(f"action must be one of {', '.join(ACTIONS)}", field="action")

    before = state(gid, sub)
    if (
        action == "repair"
        and table("GROUPS_TABLE").get_item(Key={"pk": f"GROUP#{gid}", "sk": "META"}).get("Item")
        is None
    ):
        groups_dynamo.remove(gid, sub)
    elif action in ("add", "repair"):
        groups_dynamo.add(gid, sub)
    elif action == "remove":
        if groups_dynamo.meta(gid)["createdBy"] == sub:
            raise ValidationError(
                "That's the group's owner; they delete it or hand it over", field="sub"
            )
        groups_dynamo.remove(gid, sub)
    else:
        groups_dynamo.reinvite(gid, sub)
    after = state(gid, sub)
    events_dynamo.audit(
        admin, f"membership_{action}", sub, why, {"group": gid, **before}, {"group": gid, **after}
    )
    return ok(after)
