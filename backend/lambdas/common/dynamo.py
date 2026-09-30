"""
DynamoDB access primitives.

`table()` reads the env var at call time, so a test can point at a moto table
after import.
"""

from __future__ import annotations

import os

import boto3
from botocore.exceptions import ClientError

_resource = None


def resource():
    """One cached resource per container. Region comes from the Lambda env."""
    global _resource
    if _resource is None:
        _resource = boto3.resource(
            "dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1")
        )
    return _resource


def table(env_var: str):
    name = os.environ.get(env_var)
    if not name:
        raise RuntimeError(f"{env_var} is not set")
    return resource().Table(name)


def query_all(tbl, pk: str) -> list[dict]:
    """Every item in one partition, following LastEvaluatedKey past the 1 MB page."""
    kwargs = {"KeyConditionExpression": "pk = :pk", "ExpressionAttributeValues": {":pk": pk}}
    items = []
    while True:
        page = tbl.query(**kwargs)
        items += page["Items"]
        if "LastEvaluatedKey" not in page:
            return items
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def update(env_var: str, key: dict, values: dict, condition: str | None = None) -> bool:
    """
    SETs every attribute in `values`. Each is addressable in `condition` as
    #name / :name. Returns False when the condition fails.
    """
    kwargs = {
        "Key": key,
        "UpdateExpression": "SET " + ", ".join(f"#{k} = :{k}" for k in values),
        "ExpressionAttributeNames": {f"#{k}": k for k in values},
        "ExpressionAttributeValues": {f":{k}": v for k, v in values.items()},
    }
    if condition:
        kwargs["ConditionExpression"] = condition
    try:
        table(env_var).update_item(**kwargs)
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        return False
    return True


def transact(items: list[tuple[str, dict]], env_var: str) -> bool:
    """
    One TransactWriteItems of (op, args) pairs. Args without a TableName go to
    `env_var`'s table. False when a condition failed, so the caller can re-read
    and report.
    """
    name = table(env_var).name
    try:
        resource().meta.client.transact_write_items(
            TransactItems=[{op: {"TableName": name, **args}} for op, args in items]
        )
    except ClientError as e:
        if e.response["Error"]["Code"] != "TransactionCanceledException":
            raise
        return False
    return True
