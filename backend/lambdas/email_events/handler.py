"""
SNS (armchair-mail-events) - suppress each address SES reports as a hard bounce or a complaint.

The topic carries the configuration set's BOUNCE and COMPLAINT events
(ses.tf). A transient bounce (mailbox full, greylisting) is logged and left
alone: the address may take mail tomorrow. Every send checks the suppression
list first (common/mailer.py), on top of SES's own suppression for the set.
"""

from __future__ import annotations

import json

from lambdas.common.email_dynamo import suppress
from lambdas.common.logger import get_logger

log = get_logger(__file__)


def _addresses(note: dict) -> list[tuple[str, str]]:
    # Event publishing names it eventType; identity notifications, notificationType.
    kind = note.get("eventType") or note.get("notificationType")
    if kind == "Bounce":
        bounce = note["bounce"]
        if bounce["bounceType"] != "Permanent":
            log.info("transient bounce (%s), not suppressing", bounce.get("bounceSubType"))
            return []
        return [(r["emailAddress"], "bounce") for r in bounce["bouncedRecipients"]]
    if kind == "Complaint":
        return [(r["emailAddress"], "complaint") for r in note["complaint"]["complainedRecipients"]]
    log.warning("ignoring mail event %s", kind)
    return []


def handler(event, context):
    count = 0
    for record in event["Records"]:
        for address, reason in _addresses(json.loads(record["Sns"]["Message"])):
            suppress(address, reason)
            count += 1
    # The address itself stays out of the log: it is a person's email.
    log.info("suppressed %d address(es)", count)
    return {"suppressed": count}
