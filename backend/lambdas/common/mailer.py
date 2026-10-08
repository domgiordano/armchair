"""
Sends one email to one reader through SES v2, at most once per (type, event).

Show mail goes out as "DWTS · Armchair Judge <dwts@...>" or "The Traitors ·
Armchair Judge <traitors@...>"; group invites and friend requests, which belong
to no one show, as "Armchair Judge <noreply@...>". Reply-To is always noreply@,
which has no inbox, and the footer says so.

While the account is in the SES sandbox only verified addresses can receive,
so `deliver` sends to admins alone and reports everyone else as `held`,
without claiming, so nothing is marked sent that never went.
"""

from __future__ import annotations

import functools
import os
from collections import Counter
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr
from typing import NamedTuple

import boto3
from botocore.exceptions import ClientError

from lambdas.common import email_dynamo
from lambdas.common.email_prefs import SHOWS, with_defaults
from lambdas.common.email_templates import RENDER, Email
from lambdas.common.email_theme import theme
from lambdas.common.logger import get_logger
from lambdas.common.unsubscribe import link
from lambdas.common.users_dynamo import profiles

log = get_logger(__file__)

# Mail about people rather than one show: from noreply@, under the social type.
SOCIAL = {"group_invite", "friend_request"}
# Kinds whose prefs type isn't "{show}.{kind}".
KIND_TYPE = {"group_invite": "social", "friend_request": "social", "group_activated": "groups"}


class Job(NamedTuple):
    """One email to many readers, each with their own context."""

    show: str
    kind: str
    event: str
    readers: dict[str, dict]


@functools.cache
def _ses():
    return boto3.client("sesv2", region_name=os.environ.get("AWS_REGION", "us-east-1"))


@functools.cache
def production() -> bool:
    """Out of the SES sandbox. Read once per container."""
    return bool(_ses().get_account().get("ProductionAccessEnabled"))


@functools.cache
def _admins() -> frozenset[str]:
    ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    value = ssm.get_parameter(Name=os.environ["ADMIN_EMAILS_PARAM"])["Parameter"]["Value"]
    return frozenset(e.strip().lower() for e in value.split(","))


def pref_type(show: str, kind: str) -> str:
    return KIND_TYPE.get(kind, f"{show}.{kind}")


def sender(show: str, kind: str) -> str:
    domain = os.environ["EMAIL_DOMAIN"]
    if kind in SOCIAL:
        return formataddr(("Armchair Judge", f"noreply@{domain}"))
    return formataddr((f"{theme(show)['short']} · Armchair Judge", f"{show}@{domain}"))


def footer_links(sub: str, show: str, kind: str) -> list[tuple[str, str]]:
    ptype = pref_type(show, kind)
    if ptype in ("social", "groups"):
        what = "invites and requests" if ptype == "social" else "group activity"
        return [
            (f"Unsubscribe from {what}", link(sub, ptype, show)),
            ("Unsubscribe from all Armchair Judge email", link(sub, "all", show)),
        ]
    return [
        ("Unsubscribe from these", link(sub, ptype, show)),
        (f"Stop all email for {SHOWS[show]}", link(sub, show, show)),
    ]


def render(sub: str, show: str, kind: str, ctx: dict) -> Email:
    return RENDER[kind](theme(show), ctx, footer_links(sub, show, kind))


def send(address: str, sub: str, show: str, kind: str, email: Email) -> None:
    msg = EmailMessage()
    msg["From"] = sender(show, kind)
    msg["To"] = address
    msg["Reply-To"] = f"noreply@{os.environ['EMAIL_DOMAIN']}"
    msg["Subject"] = email.subject
    # Mail clients present this as "unsubscribe from this sender": the whole show,
    # or for mail about people, just that type.
    scope = KIND_TYPE.get(kind, show)
    msg["List-Unsubscribe"] = f"<{link(sub, scope, show)}>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg.set_content(email.text)
    msg.add_alternative(email.html, subtype="html")
    _ses().send_email(
        Content={"Raw": {"Data": msg.as_bytes()}},
        ConfigurationSetName=os.environ["EMAIL_CONFIG_SET"],
    )


def deliver(
    user: dict,
    show: str,
    kind: str,
    event: str,
    ctx: dict,
    now: datetime,
    suppressed: set[str],
) -> str:
    """
    One reader's copy. Returns the outcome the run counts: sent, failed, off
    (they turned the type off), noaddress, suppressed, held (sandbox) or dup
    (already sent).
    """
    ptype = pref_type(show, kind)
    if not with_defaults(user.get("emailPrefs"))[ptype]:
        return "off"
    address = (user.get("email") or "").strip().lower()
    if not address:
        return "noaddress"
    if address in suppressed:
        return "suppressed"
    if not production() and address not in _admins():
        return "held"
    sub = user["sub"]
    if not email_dynamo.claim(ptype, event, sub, now):
        return "dup"
    try:
        send(address, sub, show, kind, render(sub, show, kind, ctx))
    except ClientError as e:
        # Released so the next run retries it; the address stays out of the log.
        log.error("%s %s to %s failed: %s", ptype, event, sub, e.response["Error"]["Code"])
        email_dynamo.release(ptype, event, sub)
        return "failed"
    return "sent"


def run_jobs(jobs: list[Job], now: datetime) -> dict[str, dict[str, int]]:
    """Delivers every job and records each one's counts. Returns them by type and event."""
    if not jobs:
        return {}
    users = {u["sub"]: u for u in profiles()}
    blocked = email_dynamo.suppressed()
    out = {}
    for job in jobs:
        counts = Counter(
            deliver(users[sub], job.show, job.kind, job.event, ctx, now, blocked)
            if sub in users
            else "noprofile"
            for sub, ctx in job.readers.items()
        )
        ptype = pref_type(job.show, job.kind)
        email_dynamo.record_run(ptype, job.event, dict(counts), now)
        log.info("%s %s: %s", ptype, job.event, dict(counts))
        out[f"{ptype} {job.event}"] = dict(counts)
    return out
