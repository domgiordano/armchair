"""Seals for read-path tests: stored on the user's row as the seals endpoints store
them, or named by a device in `sealed=` (gate.sealed_param)."""

from lambdas.common.dynamo import table

VIAS = ("server", "device")


def seal(sub: str, *ids: str) -> None:
    table("USERS_TABLE").update_item(
        Key={"sub": sub},
        UpdateExpression="ADD seals :ids",
        ExpressionAttributeValues={":ids": set(ids)},
    )


def sealing(via: str, sub: str, season: str, *dances: tuple[int, str]) -> dict:
    """Seals `dances`, (ep, key), and returns the query a read must send for them."""
    if via == "device":
        return {"sealed": ",".join(f"{ep}:{key}" for ep, key in dances)}
    seal(sub, *(f"{season}|{ep}|{key}" for ep, key in dances))
    return {}
