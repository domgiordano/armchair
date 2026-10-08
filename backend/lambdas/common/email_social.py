"""
Group-invite and friend-request email, sent from the API call that made the
invite or request. Themed by the app the sender used: an invite made in
Traitors looks like Traitors. Social mail from the hub wears DWTS's look.
send_group_activated mails a group when one member starts a show for it, in
that show's look.

Best effort: by the time this runs the invite or request is stored and the
in-app notification carries it, so a mail failure is logged and the call
still succeeds.
"""

from __future__ import annotations

import os

from botocore.exceptions import BotoCoreError, ClientError

from lambdas.common import email_dynamo, mailer
from lambdas.common.logger import get_logger
from lambdas.common.groups_dynamo import members, meta
from lambdas.common.users_dynamo import card, recipient
from lambdas.common.window import now

log = get_logger(__file__)


def _show(event: dict) -> str:
    headers = event.get("headers") or {}
    origin = headers.get("origin") or headers.get("Origin")
    return "traitors" if origin == os.environ["TRAITORS_URL"] else "dwts"


def _send(show: str, kind: str, to: str, key: str, ctx: dict) -> str:
    """The outcome, or "error" when AWS failed: logged, never raised."""
    user = recipient(to)
    if user is None:
        return "noprofile"
    at = now()
    try:
        address = (user.get("email") or "").lower()
        blocked = {address} if address and email_dynamo.is_suppressed(address) else set()
        outcome = mailer.deliver(user, show, kind, key, ctx, at, blocked)
        email_dynamo.record_run(mailer.pref_type(show, kind), at.date().isoformat(), {outcome: 1}, at)
    except (BotoCoreError, ClientError):
        log.exception("%s email to %s not sent; the in-app notification stands", kind, to)
        return "error"
    return outcome


def _name(sub: str) -> str:
    return (card(sub) or {}).get("name") or "A friend"


def group_invite(event: dict, gid: str, group_name: str, by: str, to: str) -> None:
    show = _show(event)
    site = os.environ["TRAITORS_URL" if show == "traitors" else "DWTS_URL"]
    ctx = {"inviter": _name(by), "group": group_name, "url": f"{site}/groups/"}
    _send(show, "group_invite", to, f"{gid}#{by}#{to}", ctx)


def friend_request(event: dict, frm: str, to: str) -> None:
    # Traitors has no friends page; its account menu sends Friends to the hub.
    show = _show(event)
    site = os.environ["HUB_URL" if show == "traitors" else "DWTS_URL"]
    ctx = {"requester": _name(frm), "url": f"{site}/social/"}
    _send(show, "friend_request", to, f"{frm}#{to}", ctx)


SITES = {"dwts": "DWTS_URL", "traitors": "TRAITORS_URL"}


def send_group_activated(group_id: str, app: str, actor_sub: str) -> dict[str, int]:
    """
    "<actor> started <show> for <group>" to every other member, in `app`'s look
    (dwts | traitors), linking to that app's groups page with ?group=. Once per
    member per group per show, through the sent log; members who turned off the
    "groups" type are skipped. Never raises for a mail failure. Returns outcome counts.
    """
    if app not in SITES:
        raise ValueError(f"app must be one of {', '.join(SITES)}")
    group = meta(group_id)
    ctx = {
        "actor": _name(actor_sub),
        "group": group["name"],
        "url": f"{os.environ[SITES[app]]}/groups/?group={group_id}",
    }
    counts: dict[str, int] = {}
    for sub in sorted(members(group_id) - {actor_sub}):
        outcome = _send(app, "group_activated", sub, f"{group_id}#{app}", ctx)
        counts[outcome] = counts.get(outcome, 0) + 1
    return counts
