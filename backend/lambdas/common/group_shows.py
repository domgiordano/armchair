"""
Which shows a group plays. Membership is one set across every Armchair show;
each show is switched on per group, explicitly:

    GROUP#{gid}  SHOW#{app}  by, at      the group plays `app` (dwts | traitors)
    GROUP#{gid}  META        showsSeeded  the group's shows have been written once

Any member starts a show for the group, and everyone else in it is notified.
Only the owner stops one. A group from before shows existed has none written;
the first read seeds them: DWTS always, The Traitors when a member already has
Traitors points. `showsSeeded` keeps an owner's later "stop" from being undone.
"""

from __future__ import annotations

from datetime import UTC, datetime

from botocore.exceptions import ClientError

from lambdas.common import board_dynamo
from lambdas.common import notifications_dynamo as notifications
from lambdas.common.api import ValidationError, text
from lambdas.common.dynamo import query_partitions, table, transact

# App id to the catalog shows its boards are kept under.
APPS = {"dwts": ("dwts",), "traitors": ("tus", "tuk", "tukc")}


def app_ref(source: dict) -> str:
    app = text(source, "app")
    if app not in APPS:
        raise ValidationError(f"app must be one of {', '.join(APPS)}", field="app")
    return app


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def playing(subs: set[str]) -> dict[str, set[str]]:
    """Per app, who of `subs` has anything counted on its all-time board."""
    out = {}
    for app, shows in APPS.items():
        out[app] = set().union(*(board_dynamo.rows(show, board_dynamo.ALL, subs) for show in shows))
    return out


def from_rows(rows: list[dict]) -> dict[str, dict]:
    """A group's SHOW rows as {app: {by, at}}."""
    return {
        r["sk"].removeprefix("SHOW#"): {"by": r.get("by"), "at": r.get("at")}
        for r in rows
        if r["sk"].startswith("SHOW#")
    }


def seed(gid: str, meta: dict, members: set[str], active: dict[str, dict]) -> dict[str, dict]:
    """The group's shows, written first if it predates them. Safe to race: puts are conditional."""
    if meta.get("showsSeeded"):
        return active
    owner = meta["createdBy"]
    want = {"dwts"} | ({"traitors"} if playing(members)["traitors"] else set())
    at = _now()
    tbl = table("GROUPS_TABLE")
    for app in want - set(active):
        try:
            tbl.put_item(
                Item={"pk": f"GROUP#{gid}", "sk": f"SHOW#{app}", "by": owner, "at": at},
                ConditionExpression="attribute_not_exists(pk)",
            )
            active[app] = {"by": owner, "at": at}
        except ClientError as e:
            if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
                raise
    tbl.update_item(
        Key={"pk": f"GROUP#{gid}", "sk": "META"},
        UpdateExpression="SET showsSeeded = :t",
        ExpressionAttributeValues={":t": True},
    )
    return active


def start(gid: str, name: str, app: str, sub: str, members: set[str]) -> bool:
    """
    Switches `app` on for the group and tells every other member, in one
    transaction. False when it was on already, and nobody is told twice.
    """
    item = {"pk": f"GROUP#{gid}", "sk": f"SHOW#{app}", "by": sub, "at": _now()}
    ops = [("Put", {"Item": item, "ConditionExpression": "attribute_not_exists(pk)"})]
    ops += [
        notifications.put(m, "group_show_started", sub, group=gid, groupName=name, show=app)[1]
        for m in sorted(members - {sub})
    ]
    # The email for this belongs here, beside the in-app ones, once the mailer
    # (PR #213) is merged: send it to the same members after a True.
    return transact(ops, "GROUPS_TABLE")


def stop(gid: str, app: str) -> None:
    table("GROUPS_TABLE").delete_item(Key={"pk": f"GROUP#{gid}", "sk": f"SHOW#{app}"})


def members_playing(app: str) -> set[str]:
    """Everyone in a group that has started `app`. A scan for SHOW rows: there is no index by show."""
    tbl = table("GROUPS_TABLE")
    kwargs = {
        "FilterExpression": "sk = :sk",
        "ExpressionAttributeValues": {":sk": f"SHOW#{app}"},
        "ProjectionExpression": "pk",
    }
    gids = set()
    while True:
        page = tbl.scan(**kwargs)
        gids |= {r["pk"].removeprefix("GROUP#") for r in page["Items"]}
        if "LastEvaluatedKey" not in page:
            break
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    subs: set[str] = set()
    for rows in query_partitions("GROUPS_TABLE", [f"GROUP#{g}" for g in sorted(gids)]).values():
        subs |= {r["sk"].removeprefix("MEMBER#") for r in rows if r["sk"].startswith("MEMBER#")}
    return subs
