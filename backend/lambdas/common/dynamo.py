"""
DynamoDB access primitives.

`table()` reads the env var at call time, so a test can point at a moto table
after import.
"""

from __future__ import annotations

import os

import boto3

_resource = None


def resource():
    """One cached resource per container. Region comes from the Lambda env."""
    global _resource
    if _resource is None:
        _resource = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    return _resource


def table(env_var: str):
    name = os.environ.get(env_var)
    if not name:
        raise RuntimeError(f"{env_var} is not set")
    return resource().Table(name)
