"""
POST /groups/manage - the owner's changes to a group.

Body: {"group": "<gid>", "action": ..., ...} where action is one of
    rename     {"name": "1-40 characters"}
    remove     {"sub": "<member>"}           take a member out
    approval   {"approval": true | false}    whether the invite link needs approving
    approve    {"sub": "<requester>"}        let a join request in
    deny       {"sub": "<requester>"}        turn one away
Returns {ok: true}. Anyone but the owner gets 403. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import ValidationError, api_handler, body, caller_sub, ok, text
from lambdas.common.groups_dynamo import answer, owned, ref, remove, rename, set_approval
from lambdas.common.social_dynamo import target

NAME_MAX = 40
ACTIONS = ("rename", "remove", "approval", "approve", "deny")


@api_handler("groups_manage")
def handler(event, context):
    sub = caller_sub(event)
    source = body(event)
    gid = ref(source)
    action = source.get("action")
    if action not in ACTIONS:
        raise ValidationError(f"action must be one of {', '.join(ACTIONS)}", field="action")
    owned(gid, sub)

    if action == "rename":
        name = text(source, "name")
        if len(name) > NAME_MAX:
            raise ValidationError(f"name must be at most {NAME_MAX} characters", field="name")
        rename(gid, name)
    elif action == "approval":
        on = source.get("approval")
        if not isinstance(on, bool):
            raise ValidationError("approval must be true or false", field="approval")
        set_approval(gid, on)
    elif action == "remove":
        # target() refuses the caller's own sub, so the owner can't be removed.
        remove(gid, target(source, sub))
    else:
        answer(gid, sub, target(source, sub), action == "approve")
    return ok({"ok": True})
