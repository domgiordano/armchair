"""
The Anthropic Messages API over urllib, for the dance write-ups. The SDK would
put httpx and pydantic-core in the shared layer for one POST.

The key is the SecureString KEY_PARAM, read once per container.
"""

from __future__ import annotations

import json
import os
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import boto3

from lambdas.common.logger import get_logger

log = get_logger(__file__)

API = "https://api.anthropic.com/v1/messages"
VERSION = "2023-06-01"
KEY_PARAM = "/armchair/api/ANTHROPIC_API_KEY"
# Set by Terraform (lambda_writeups.tf). Haiku 4.5 kept a whole write-up for
# 28% of ep 5's dances against 94% for Sonnet 5.5 at low effort, almost all on
# quotes over the word limit, so Sonnet it is. Effort is sent only when set:
# Haiku rejects the parameter.
MODEL = os.environ.get("WRITEUPS_MODEL", "claude-sonnet-5-5")
EFFORT = os.environ.get("WRITEUPS_EFFORT", "low")
# USD per million tokens, input and output. A model missing here fails at
# import, before it can spend past the cap. Sonnet 5.5's is assumed from
# Sonnet's usual price; the Models API doesn't publish prices.
PRICES = {
    "claude-sonnet-5-5": (3.00, 15.00),
    "claude-haiku-4-5-20251001": (1.00, 5.00),
    "claude-opus-5-5": (4.00, 20.00),
}
PRICE = PRICES[MODEL]
# Overloaded and rate-limited answers are worth another try; a 400 is not.
RETRY = {429, 500, 502, 503, 504, 529}
ATTEMPTS = 3
TIMEOUT = 240

_key: str | None = None


class ClaudeError(Exception):
    pass


def api_key() -> str:
    global _key
    if _key is None:
        ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        try:
            _key = ssm.get_parameter(Name=KEY_PARAM, WithDecryption=True)["Parameter"]["Value"]
        except ssm.exceptions.ParameterNotFound:
            log.error(
                "SSM SecureString %s is missing: no write-ups can be generated until it is set",
                KEY_PARAM,
            )
            raise
    return _key


def cost(usage: dict) -> float:
    """USD for one response's `usage`. Cache reads and writes are billed as input here, an overcount."""
    tokens_in = sum(
        usage.get(k) or 0
        for k in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")
    )
    return (tokens_in * PRICE[0] + (usage.get("output_tokens") or 0) * PRICE[1]) / 1_000_000


def estimate(body: dict) -> float:
    """
    A ceiling on what `body` can cost: about 3 characters per input token,
    which overcounts English, and every output token max_tokens allows.
    """
    tokens_in = len(json.dumps(body)) / 3
    return (tokens_in * PRICE[0] + body["max_tokens"] * PRICE[1]) / 1_000_000


def messages(body: dict) -> dict:
    """POST one Messages request, retrying overload and rate limits with backoff."""
    req = Request(
        API,
        data=json.dumps(body).encode(),
        headers={
            "x-api-key": api_key(),
            "anthropic-version": VERSION,
            "content-type": "application/json",
        },
        method="POST",
    )
    for attempt in range(ATTEMPTS):
        try:
            with urlopen(req, timeout=TIMEOUT) as resp:
                return json.load(resp)
        except HTTPError as e:
            detail = e.read().decode(errors="replace")[:500]
            if e.code not in RETRY or attempt == ATTEMPTS - 1:
                raise ClaudeError(f"Messages API {e.code}: {detail}") from e
            wait = float(e.headers.get("retry-after") or 5 * 2**attempt)
            log.warning("Messages API %s, retrying in %.0fs", e.code, wait)
            time.sleep(wait)


def tool_input(response: dict, name: str) -> dict:
    """The input of the forced tool call, or ClaudeError when the model refused or ran out of room."""
    stop = response.get("stop_reason")
    if stop in ("refusal", "max_tokens"):
        raise ClaudeError(f"stop_reason {stop}")
    for block in response.get("content") or []:
        if block.get("type") == "tool_use" and block.get("name") == name:
            return block["input"]
    raise ClaudeError(f"no {name} tool call in the response (stop_reason {stop})")
