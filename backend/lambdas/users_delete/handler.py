"""
POST /users/delete - delete the caller's account and everything that names them.

Groups go first, while the caller's group links still say which groups they're
in: owned groups pass to the member who joined first, or are deleted when the
caller is alone. Then every row in scores, board, social and groups that names
the caller, their activity events, their photos, their profile, and the Cognito
user last. Every step is safe to repeat, and the token keeps working until
Cognito goes, so a failure partway is retried by calling this again.

Crowd means are computed from score rows at read time and leaderboards from the
caller's own BOARD rows, so deleting rows is all it takes to leave both.
Returns {ok: true}.
"""

from __future__ import annotations

import os

import boto3
from botocore.exceptions import ClientError

from lambdas.common import avatars, events_dynamo
from lambdas.common.api import UnauthorizedError, api_handler, caller_sub, claims, ok
from lambdas.common.dynamo import table
from lambdas.common.groups_dynamo import forget

# Scores before board, so a board reconcile racing this finds no score to
# write the caller's ERR rows back from.
TABLES = ("SCORES_TABLE", "BOARD_TABLE", "SOCIAL_TABLE", "GROUPS_TABLE")


def purge(env_var: str, sub: str) -> None:
    """
    Deletes every row whose keys contain the sub, or whose from, sub or by is it:
    friend edges on both sides, notifications to and from them, their search row
    and invite code, invites and join requests, scores, picks, ERR, PTS and BOARD
    rows, and every stats digest holding their answers (common/digest.py). No
    index is keyed by user across all of these, so this is a Scan.
    """
    tbl = table(env_var)
    kwargs = {
        "FilterExpression": "contains(pk, :sub) OR contains(sk, :sub)"
        " OR #from = :sub OR #sub = :sub OR #by = :sub OR attribute_exists(answers.#me)",
        "ExpressionAttributeNames": {"#from": "from", "#sub": "sub", "#by": "by", "#me": sub},
        "ExpressionAttributeValues": {":sub": sub},
        "ProjectionExpression": "pk, sk",
    }
    keys = []
    while True:
        page = tbl.scan(**kwargs)
        keys += page["Items"]
        if "LastEvaluatedKey" not in page:
            break
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    with tbl.batch_writer() as batch:
        for key in keys:
            batch.delete_item(Key=key)


def cognito():
    return boto3.client("cognito-idp", region_name=os.environ.get("AWS_REGION", "us-east-1"))


def delete_login(username: str) -> None:
    try:
        cognito().admin_delete_user(
            UserPoolId=os.environ["COGNITO_USER_POOL_ID"], Username=username
        )
    except ClientError as e:
        # A retry after the delete went through but the response didn't.
        if e.response["Error"]["Code"] != "UserNotFoundException":
            raise


@api_handler("users_delete")
def handler(event, context):
    sub = caller_sub(event)
    # Google users are google_<id> in the pool, not their sub.
    username = claims(event).get("cognito:username")
    if not username:
        raise UnauthorizedError("No username on the token")

    forget(sub)
    for env_var in TABLES:
        purge(env_var, sub)
    events_dynamo.forget(sub)
    avatars.delete_all(sub)
    table("USERS_TABLE").delete_item(Key={"sub": sub})
    delete_login(username)
    return ok({"ok": True})
