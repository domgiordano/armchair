"""
Uploaded profile photos: armchair-avatars-<account>, read through its own
CloudFront distribution (infrastructure/terraform/avatars.tf). A browser
uploads straight to S3 with a presigned POST; the key names its owner.
"""

from __future__ import annotations

import os
import re
import uuid

import boto3

TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_BYTES = 2 * 1024 * 1024

_s3 = None


def s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    return _s3


def bucket() -> str:
    name = os.environ.get("AVATARS_BUCKET")
    if not name:
        raise RuntimeError("AVATARS_BUCKET is not set")
    return name


def new_key(sub: str, content_type: str) -> str:
    return f"avatars/{sub}/{uuid.uuid4().hex}.{TYPES[content_type]}"


def owns(sub: str, key: str) -> bool:
    """True when `key` is one new_key could have made for this sub."""
    return (
        re.fullmatch(rf"avatars/{re.escape(sub)}/[0-9a-f]{{32}}\.(jpg|png|webp)", key) is not None
    )


def url(key: str) -> str:
    return f"{os.environ['AVATARS_URL']}/{key}"


def presigned_post(key: str, content_type: str) -> dict:
    """
    S3 enforces the policy, not this code: the exact key (boto adds that
    condition), the declared type, and the size. Five minutes is enough to
    pick, crop and send one photo.
    """
    return s3().generate_presigned_post(
        Bucket=bucket(),
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[{"Content-Type": content_type}, ["content-length-range", 1, MAX_BYTES]],
        ExpiresIn=300,
    )


def delete(key: str) -> None:
    s3().delete_object(Bucket=bucket(), Key=key)
