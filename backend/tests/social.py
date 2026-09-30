"""Friend-graph helpers shared by the social tests."""

import json

from lambdas.friends_accept.handler import handler as accept_handler
from lambdas.friends_block.handler import handler as block_handler
from lambdas.friends_remove.handler import handler as remove_handler
from lambdas.friends_request.handler import handler as request_handler
from lambdas.users_me.handler import handler as me_handler
from tests.events import PICTURE, SUB, authorized_event

A = SUB
B = "3f1c2b9a-0000-4000-8000-000000000002"
C = "3f1c2b9a-0000-4000-8000-000000000003"


def call(handler, event) -> tuple[int, dict]:
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def sign_in(sub, name, picture=PICTURE):
    event = authorized_event(sub=sub, name=name, picture=picture, email=f"{sub[-1]}@example.com")
    assert call(me_handler, event)[0] == 200


def post(handler, path, sub, payload) -> tuple[int, dict]:
    return call(handler, authorized_event(path=path, method="POST", sub=sub, body=payload))


def ask(frm, to):
    return post(request_handler, "/friends/request", frm, {"sub": to})


def accept(frm, to):
    return post(accept_handler, "/friends/accept", frm, {"sub": to})


def remove(frm, to):
    return post(remove_handler, "/friends/remove", frm, {"sub": to})


def block(frm, to, blocked=True):
    return post(block_handler, "/friends/block", frm, {"sub": to, "blocked": blocked})
