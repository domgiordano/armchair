"""
POST /admin/delete - delete someone's account, as if they had asked. Admins only.

Body: {"sub": <user>, "reason": str, "confirm": <their email>}. Finds their Cognito
username, then invokes users_delete with their identity, so there is one deletion
path. The audit entry keeps who, when and why, but no profile detail: the account's
data is gone.
"""

from __future__ import annotations

import json
import os

import boto3

from lambdas.common import events_dynamo
from lambdas.common.admins import reason, require_admin, target
from lambdas.common.api import NotFoundError, ValidationError, api_handler, body, ok
from lambdas.common.dynamo import table


def cognito():
    return boto3.client("cognito-idp", region_name=os.environ.get("AWS_REGION", "us-east-1"))


def lambdas():
    return boto3.client("lambda", region_name=os.environ.get("AWS_REGION", "us-east-1"))


def username(sub: str) -> str:
    users = cognito().list_users(
        UserPoolId=os.environ["COGNITO_USER_POOL_ID"], Filter=f'sub = "{sub}"', Limit=1
    )["Users"]
    if not users:
        raise NotFoundError("No sign-in for that user", sub=sub)
    return users[0]["Username"]


@api_handler("admin_delete")
def handler(event, context):
    admin = require_admin(event)
    data = body(event)
    sub, why = target(data), reason(data)
    profile = table("USERS_TABLE").get_item(Key={"sub": sub}).get("Item")
    if profile is None:
        raise NotFoundError("No such user", sub=sub)
    if (data.get("confirm") or "").strip().lower() != profile["email"].lower():
        raise ValidationError("confirm must be the user's email", field="confirm")

    claims = {
        "sub": sub,
        "email": profile["email"],
        "cognito:username": username(sub),
        "token_use": "id",
    }
    res = lambdas().invoke(
        FunctionName=f"{os.environ['APP_NAME']}-users-delete",
        Payload=json.dumps(
            {
                "httpMethod": "POST",
                "path": "/users/delete",
                "headers": {},
                "requestContext": {"authorizer": {"claims": claims}},
            }
        ).encode(),
    )
    out = json.loads(res["Payload"].read())
    if res.get("FunctionError") or out.get("statusCode") != 200:
        raise RuntimeError(f"users_delete failed for {sub}: {out}")
    events_dynamo.audit(admin, "delete", sub, why)
    return ok({"deleted": sub})
