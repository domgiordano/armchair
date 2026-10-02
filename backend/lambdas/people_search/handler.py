"""
GET /people/search?q=<text>[&show=dwts] - users, stars, pros and judges whose name matches.

`q` is 2-40 characters, matched with case, accents and apostrophes folded away.
Each group ranks names that start with `q`, then names with a word that does,
then names holding it anywhere; ties go to the most recent season, then the name.

    {users: [{sub, name, picture, avatarKind, status}],
     stars | pros | judges: [{id, name, roles, headshot, seasons}]}

Users are anyone whose display name starts with `q` (the friends search index)
plus the caller's friends matched anywhere in theirs. Never the caller, never
anyone blocked either way, never an email. A person sits in the group of the
role they held most recently. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import ValidationError, api_handler, caller_sub, ok, query
from lambdas.common.episodes_dynamo import show_ref
from lambdas.common.people import fold, index, rank
from lambdas.common.social_dynamo import normalize, peers, search, status
from lambdas.common.users_dynamo import cards

Q_MAX = 40
LIMIT = 8
GROUPS = {"celebrity": "stars", "pro": "pros", "judge": "judges"}


@api_handler("people_search")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    show = show_ref(params)
    raw = str(params.get("q") or "")
    q = fold(raw)
    if not 2 <= len(q) <= Q_MAX:
        raise ValidationError(f"q must be 2-{Q_MAX} characters", field="q")

    out: dict[str, list] = {"users": _users(sub, normalize(raw), q)}
    groups: dict[str, list] = {g: [] for g in GROUPS.values()}
    for row in index(show):
        r = rank(row["name"], q)
        if r is not None:
            groups[GROUPS[row["roles"][0]]].append((r, -max(row["seasons"]), row))
    for name, hits in groups.items():
        hits.sort(key=lambda h: (h[0], h[1], h[2]["name"]))
        out[name] = [
            {
                "id": row["sk"].removeprefix("PERSON#"),
                **{k: row.get(k) for k in ("name", "roles", "headshot", "seasons")},
            }
            for _, _, row in hits[:LIMIT]
        ]
    return ok(out)


def _users(sub: str, prefix: str, q: str) -> list[dict]:
    mine = peers(sub)
    found = {row["sub"]: row for row in search(prefix)} if len(prefix) >= 2 else {}
    friends = {s for s, item in mine.items() if status(item) == "friend"}
    found |= {s: c for s, c in cards(friends).items() if c["name"] and s not in found}

    hits = []
    for other, row in found.items():
        relation = status(mine.get(other))
        r = rank(row.get("name") or "", q)
        if other == sub or relation == "blocked" or r is None:
            continue
        card = {k: row.get(k) for k in ("name", "picture", "avatarKind")}
        hits.append(
            (
                r,
                relation != "friend",
                fold(card["name"]),
                {"sub": other, **card, "status": relation},
            )
        )
    hits.sort(key=lambda h: h[:3])
    return [h[3] for h in hits[:LIMIT]]
