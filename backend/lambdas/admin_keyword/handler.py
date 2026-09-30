"""
POST /admin/keyword - set a couple's SMS keyword override. Admins only.

Body: { "cid": str, "keyword": str }. The override beats the derived keyword,
which can't split spelling variants like Conner/Connor (PLAN.md "SMS keyword
derivation"). To undo one, set it to the derived keyword.
"""

from __future__ import annotations

from lambdas.common.admins import require_admin
from lambdas.common.api import NotFoundError, api_handler, body, ok, text
from lambdas.common.catalog import SEASON_PK
from lambdas.common.dynamo import table


@api_handler("admin_keyword")
def handler(event, context):
    require_admin(event)
    data = body(event)
    cid = text(data, "cid")
    keyword = text(data, "keyword")
    catalog = table("CATALOG_TABLE")
    try:
        catalog.update_item(
            Key={"pk": SEASON_PK, "sk": f"CONTESTANT#{cid}"},
            UpdateExpression="SET keywordOverride = :k",
            ConditionExpression="attribute_exists(pk)",
            ExpressionAttributeValues={":k": keyword},
        )
    except catalog.meta.client.exceptions.ConditionalCheckFailedException:
        raise NotFoundError(f"No contestant {cid}", field="cid")
    return ok({"cid": cid, "keyword": keyword})
