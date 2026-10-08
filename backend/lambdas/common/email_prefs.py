"""
Email preferences, stored on the users row as `emailPrefs`: {type: bool}.

Every type is on until turned off, so a missing key reads as on. That makes
email opt-out: the apps show a first-run notice (`emailNoticeAt`) and every
email carries a one-tap unsubscribe for its own type and for its whole show.
"""

from __future__ import annotations

from lambdas.common.api import ValidationError

# The labels are the settings toggles' wording, reused on the unsubscribe page.
TYPES = {
    "dwts.tonight": "Show-night reminder, two hours before DWTS airs",
    "dwts.closing": "A heads-up before a week locks while you still have dances to score",
    "dwts.digest": "Your weekly DWTS results and standings",
    "traitors.tonight": "Release-night reminder before a new Traitors episode",
    "traitors.digest": "Your weekly Traitors results and standings",
    "social": "Group invites and friend requests",
    "groups": "When someone in your group starts a show",
}
SHOWS = {"dwts": "Dancing with the Stars", "traitors": "The Traitors"}
# What an unsubscribe link can turn off: one type, a whole show, or everything.
SCOPES = {*TYPES, *SHOWS, "all"}


def with_defaults(stored: dict | None) -> dict[str, bool]:
    stored = stored or {}
    return {t: bool(stored.get(t, True)) for t in TYPES}


def covered(scope: str) -> list[str]:
    if scope == "all":
        return list(TYPES)
    if scope in SHOWS:
        return [t for t in TYPES if t.startswith(f"{scope}.")]
    return [scope]


def describe(scope: str) -> str:
    if scope == "all":
        return "all Armchair Judge emails"
    if scope in SHOWS:
        return f"all {SHOWS[scope]} emails"
    return f"&ldquo;{TYPES[scope]}&rdquo; emails"


def parse(value) -> dict[str, bool]:
    """A partial update: known types only, real booleans only (bool, not 0/1 or "true")."""
    valid = (
        isinstance(value, dict)
        and value
        and value.keys() <= TYPES.keys()
        and all(type(v) is bool for v in value.values())
    )
    if not valid:
        raise ValidationError(
            f"prefs must map some of {', '.join(TYPES)} to true or false", field="prefs"
        )
    return value
