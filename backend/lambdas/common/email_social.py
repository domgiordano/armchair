"""
Group-invite and friend-request email, sent from the API call that made the
invite or request. Themed by the app the sender used: an invite made in
Traitors looks like Traitors. Social mail from the hub wears DWTS's look.

Best effort: by the time this runs the invite or request is stored and the
in-app notification carries it, so a mail failure is logged and the call
still succeeds.
"""

from __future__ import annotations

import os

from botocore.exceptions import BotoCoreError, ClientError

from lambdas.common import email_dynamo, mailer
from lambdas.common.logger import get_logger
from lambdas.common.users_dynamo import card, recipient
from lambdas.common.window import now

log = get_logger(__file__)


def _show(event: dict) -> str:
    headers = event.get("headers") or {}
    origin = headers.get("origin") or headers.get("Origin")
    return "traitors" if origin == os.environ["TRAITORS_URL"] else "dwts"


def _send(event: dict, kind: str, to: str, key: str, ctx: dict) -> None:
    user = recipient(to)
    if user is None:
        return
    at = now()
    show = _show(event)
    try:
        address = (user.get("email") or "").lower()
        blocked = {address} if address and email_dynamo.is_suppressed(address) else set()
        outcome = mailer.deliver(user, show, kind, key, ctx, at, blocked)
        email_dynamo.record_run("social", at.date().isoformat(), {outcome: 1}, at)
    except (BotoCoreError, ClientError):
        log.exception("%s email to %s not sent; the in-app notification stands", kind, to)


def _name(sub: str) -> str:
    return (card(sub) or {}).get("name") or "A friend"


def group_invite(event: dict, gid: str, group_name: str, by: str, to: str) -> None:
    show = _show(event)
    site = os.environ["TRAITORS_URL" if show == "traitors" else "DWTS_URL"]
    ctx = {"inviter": _name(by), "group": group_name, "url": f"{site}/groups/"}
    _send(event, "group_invite", to, f"{gid}#{by}#{to}", ctx)


def friend_request(event: dict, frm: str, to: str) -> None:
    # Traitors has no friends page; its account menu sends Friends to the hub.
    site = os.environ["HUB_URL" if _show(event) == "traitors" else "DWTS_URL"]
    ctx = {"requester": _name(frm), "url": f"{site}/social/"}
    _send(event, "friend_request", to, f"{frm}#{to}", ctx)
