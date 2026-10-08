import json

from lambdas.common.email_dynamo import suppressed
from lambdas.email_events.handler import handler


def sns(*notes: dict) -> dict:
    return {"Records": [{"Sns": {"Message": json.dumps(n)}} for n in notes]}


def bounce(kind: str, *addresses: str) -> dict:
    recipients = [{"emailAddress": a} for a in addresses]
    return {"eventType": "Bounce", "bounce": {"bounceType": kind, "bouncedRecipients": recipients}}


def test_hard_bounce_and_complaint_suppress_the_address(aws):
    complaint = {
        "notificationType": "Complaint",
        "complaint": {"complainedRecipients": [{"emailAddress": "Loud@Example.com"}]},
    }
    assert handler(sns(bounce("Permanent", "gone@example.com"), complaint), None) == {
        "suppressed": 2
    }
    assert suppressed() == {"gone@example.com", "loud@example.com"}


def test_transient_bounce_and_other_events_change_nothing(aws):
    other = {"eventType": "Delivery", "delivery": {}}
    assert handler(sns(bounce("Transient", "full@example.com"), other), None) == {"suppressed": 0}
    assert suppressed() == set()
