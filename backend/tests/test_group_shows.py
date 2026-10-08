"""Per-group shows: started explicitly, seeded for old groups, announced to members."""

from lambdas.groups_create.handler import handler as create_handler
from lambdas.groups_delete.handler import handler as delete_handler
from lambdas.groups_shows.handler import handler as shows_handler
from lambdas.notifications_list.handler import handler as notifications_handler
from tests.conftest import BOARD_TABLE, GROUPS_TABLE
from tests.events import SUB, authorized_event
from tests.test_groups import B, call, create, join, mine, rows

C = "3f1c2b9a-0000-4000-8000-000000000003"


def shows(group: dict) -> dict:
    return {s["app"]: s for s in group["shows"]}


def toggle(gid, app, active, sub=SUB):
    body = {"group": gid, "app": app, "active": active}
    return call(
        shows_handler, authorized_event(path="/groups/shows", method="POST", sub=sub, body=body)
    )


def notes(sub):
    status, body = call(
        notifications_handler, authorized_event(path="/notifications/list", sub=sub)
    )
    assert status == 200, body
    return body["data"]


def make(aws, app=None):
    event_body = {"name": "Family", **({"app": app} if app else {})}
    event = authorized_event(path="/groups/create", method="POST", body=event_body)
    status, body = call(create_handler, event)
    assert status == 200, body
    return body["data"]


def test_a_group_starts_on_the_show_it_was_made_in(aws):
    group = make(aws, app="dwts")
    s = shows(mine()[0])
    assert s["dwts"]["active"] and s["dwts"]["by"] == SUB
    assert not s["traitors"]["active"] and s["traitors"]["by"] is None
    assert group["id"] == mine()[0]["id"]


def test_a_group_made_on_the_hub_plays_nothing_yet(aws):
    make(aws)
    assert not any(s["active"] for s in mine()[0]["shows"])


def test_an_old_group_is_seeded_from_what_members_play(aws):
    gid = create()[1]["data"]["id"]
    # create() predates shows: strip what a new group gets, as an old one looks.
    aws.Table(GROUPS_TABLE).update_item(
        Key={"pk": f"GROUP#{gid}", "sk": "META"}, UpdateExpression="REMOVE showsSeeded"
    )
    aws.Table(BOARD_TABLE).put_item(Item={"pk": "BOARD#tuk#all", "sk": f"USER#{SUB}", "pts": 3})
    s = shows(mine()[0])
    assert s["dwts"]["active"] and s["traitors"]["active"]
    assert s["traitors"]["playing"] == [SUB]
    assert {r["sk"] for r in rows(aws, f"GROUP#{gid}")} >= {"SHOW#dwts", "SHOW#traitors"}


def test_starting_a_show_tells_every_other_member_once(aws):
    group = make(aws, app="dwts")
    join(group["inviteCode"], sub=B)
    join(group["inviteCode"], sub=C)
    status, body = toggle(group["id"], "traitors", True, sub=B)
    assert status == 200 and body["data"] == {"app": "traitors", "active": True, "started": True}
    assert shows(mine()[0])["traitors"]["by"] == B
    for sub in (SUB, C):
        started = [n for n in notes(sub) if n["type"] == "group_show_started"]
        assert len(started) == 1
        assert started[0]["show"] == "traitors"
        assert started[0]["group"] == {"id": group["id"], "name": "Family"}
        assert started[0]["from"]["sub"] == B
    assert not [n for n in notes(B) if n["type"] == "group_show_started"]

    again = toggle(group["id"], "traitors", True, sub=C)[1]["data"]
    assert again["started"] is False
    assert len([n for n in notes(SUB) if n["type"] == "group_show_started"]) == 1


def test_only_members_start_and_only_the_owner_stops(aws):
    group = make(aws, app="dwts")
    join(group["inviteCode"], sub=B)
    assert toggle(group["id"], "traitors", True, sub=C)[0] == 403
    assert toggle(group["id"], "dwts", False, sub=B)[0] == 403
    assert toggle(group["id"], "dwts", False)[0] == 200
    # Stopped stays stopped: an old group's seeding never runs again.
    assert not shows(mine()[0])["dwts"]["active"]


def test_bad_apps_and_flags_are_400(aws):
    group = make(aws)
    assert toggle(group["id"], "survivor", True)[0] == 400
    assert toggle(group["id"], "dwts", "yes")[0] == 400


def test_joining_by_link_leaves_the_shows_alone(aws):
    group = make(aws, app="traitors")
    join(group["inviteCode"], sub=B)
    s = shows(mine(sub=B)[0])
    assert s["traitors"]["active"] and not s["dwts"]["active"]


def test_deleting_the_group_takes_its_shows(aws):
    group = make(aws, app="dwts")
    event = authorized_event(path="/groups/delete", method="POST", body={"group": group["id"]})
    assert call(delete_handler, event)[0] == 200
    assert rows(aws, f"GROUP#{group['id']}") == []
