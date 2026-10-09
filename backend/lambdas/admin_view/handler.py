"""
GET /admin/view?as=<user>&screen=<screen>[&season=..&ep=..] - what one user sees on a
screen, read-only. Admins only.

Invokes the screen's own GET function with the user's identity, so the answer is
exactly theirs, through the same gate and their own seals. Only functions that never
write are listed, which is what keeps this read-only: users_me (refreshes the profile)
and friends_list (mints an invite code) are left out. Other query parameters but
`sealed` pass through for the function to validate. Returns {status, data, error} as that function answered.
"""

from __future__ import annotations

import json
import os

import boto3

from lambdas.common.admins import require_admin, target
from lambdas.common.api import NotFoundError, ValidationError, api_handler, ok, query
from lambdas.common.dynamo import table

# Mirrored in Terraform (admin_view_screens in lambda.tf), which grants the invoke.
SCREENS = {
    "overview": "overview_get",
    "profile": "users_get",
    "episode": "episodes_state",
    "stats": "stats_get",
    "groups": "groups_mine",
    "notifications": "notifications_list",
    "leaderboard": "leaderboard_get",
    "week_board": "week_board_get",
    "performers": "performers_get",
    "traitors_season": "traitors_season",
    "traitors_episode": "traitors_episode",
    "traitors_stats": "traitors_stats",
}


def lambdas():
    return boto3.client("lambda", region_name=os.environ.get("AWS_REGION", "us-east-1"))


@api_handler("admin_view")
def handler(event, context):
    require_admin(event)
    q = dict(query(event))
    sub = target(q, "as")
    screen = q.pop("screen", None)
    if screen not in SCREENS:
        raise ValidationError(f"screen must be one of {', '.join(SCREENS)}", field="screen")
    q.pop("as")
    # The screen applies the user's own seals (common/seals.py), not the admin's device's.
    q.pop("sealed", None)
    params = {k: v for k, v in q.items() if isinstance(v, str) and len(v) <= 64}
    profile = table("USERS_TABLE").get_item(Key={"sub": sub}).get("Item")
    if profile is None:
        raise NotFoundError("No such user", sub=sub)

    claims = {"sub": sub, "email": profile["email"], "token_use": "id"}
    if profile.get("name"):
        claims["name"] = profile["name"]
    fn = SCREENS[screen]
    res = lambdas().invoke(
        FunctionName=f"{os.environ['APP_NAME']}-{fn.replace('_', '-')}",
        Payload=json.dumps(
            {
                "httpMethod": "GET",
                "path": f"/{fn}",
                "headers": {},
                "queryStringParameters": params or None,
                "requestContext": {"authorizer": {"claims": claims}},
            }
        ).encode(),
    )
    out = json.loads(res["Payload"].read())
    if res.get("FunctionError"):
        raise RuntimeError(f"{fn} failed for admin view: {out}")
    answer = json.loads(out["body"])
    return ok(
        {
            "screen": screen,
            "status": out["statusCode"],
            "data": answer["data"],
            "error": answer["error"],
        }
    )
