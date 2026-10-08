import boto3
import pytest
from moto import mock_aws

USERS_TABLE = "t-armchair-users"
CATALOG_TABLE = "t-armchair-catalog"
PERFORMANCES_TABLE = "t-armchair-performances"
SCORES_TABLE = "t-armchair-scores"
GROUPS_TABLE = "t-armchair-groups"
BOARD_TABLE = "t-armchair-board"
SOCIAL_TABLE = "t-armchair-social"
WRITEUPS_TABLE = "t-armchair-writeups"
EMAIL_TABLE = "t-armchair-email"
EVENTS_TABLE = "t-armchair-events"
FAVORITES_TABLE = "t-armchair-favorites"
AVATARS_BUCKET = "t-armchair-avatars"
AVATARS_URL = "https://avatars.example.net"

PK_SK = {
    "KeySchema": [
        {"AttributeName": "pk", "KeyType": "HASH"},
        {"AttributeName": "sk", "KeyType": "RANGE"},
    ],
    "AttributeDefinitions": [
        {"AttributeName": "pk", "AttributeType": "S"},
        {"AttributeName": "sk", "AttributeType": "S"},
    ],
}


@pytest.fixture(autouse=True)
def fandom_offline(monkeypatch):
    """Fandom unreachable and unthrottled unless a test answers for it."""
    import urllib.request

    from lambdas.common import fandom

    def offline(req, timeout=None):
        raise OSError(f"offline: {req.full_url}")

    monkeypatch.setattr(fandom, "GAP", 0)
    monkeypatch.setattr(fandom, "_left", float("inf"))
    monkeypatch.setattr(urllib.request, "urlopen", offline)


@pytest.fixture(autouse=True)
def no_scoring_window(request, monkeypatch):
    """
    Every episode of the current season takes answers, as before scoring
    windows, unless a test is marked scoring_window. Most tests replay a past
    season as the current one on today's clock, where every window closed long
    ago, or answer S35 nights still to air; they test the gate, not the clock.
    """
    if request.node.get_closest_marker("scoring_window"):
        return
    from lambdas.common import window
    from lambdas.common.gate import is_open

    monkeypatch.setattr(window, "is_live", lambda meta, span, at: not is_open(meta))
    monkeypatch.setattr(window, "closed", lambda meta, span, at: is_open(meta))


@pytest.fixture(autouse=True)
def ses_sandbox(monkeypatch):
    """Every test runs as if SES were in the sandbox with no admins, so nothing sends
    unless a test asks: moto has no GetAccount. The outbox fixture lifts it."""
    from lambdas.common import mailer

    monkeypatch.setattr(mailer, "production", lambda: False)
    monkeypatch.setattr(mailer, "_admins", lambda: frozenset())


@pytest.fixture
def aws(monkeypatch):
    """A moto account with the tables Terraform creates."""
    for k, v in {
        "AWS_REGION": "us-east-1",
        "AWS_DEFAULT_REGION": "us-east-1",
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
        "USERS_TABLE": USERS_TABLE,
        "CATALOG_TABLE": CATALOG_TABLE,
        "PERFORMANCES_TABLE": PERFORMANCES_TABLE,
        "SCORES_TABLE": SCORES_TABLE,
        "GROUPS_TABLE": GROUPS_TABLE,
        "BOARD_TABLE": BOARD_TABLE,
        "SOCIAL_TABLE": SOCIAL_TABLE,
        "WRITEUPS_TABLE": WRITEUPS_TABLE,
        "EMAIL_TABLE": EMAIL_TABLE,
        "EVENTS_TABLE": EVENTS_TABLE,
        "FAVORITES_TABLE": FAVORITES_TABLE,
        "AVATARS_BUCKET": AVATARS_BUCKET,
        "AVATARS_URL": AVATARS_URL,
        "RECAPS_BUCKET": AVATARS_BUCKET,
        "APP_NAME": "armchair",
        "CORS_ALLOW_ORIGIN": "https://dwts.armchairjudge.com,http://localhost:3000",
        "API_URL": "https://api.dwts.armchairjudge.com",
        "DWTS_URL": "https://dwts.armchairjudge.com",
        "TRAITORS_URL": "https://traitors.armchairjudge.com",
        "HUB_URL": "https://armchairjudge.com",
    }.items():
        monkeypatch.setenv(k, v)
    with mock_aws():
        client = boto3.client("dynamodb")
        client.create_table(
            TableName=USERS_TABLE,
            KeySchema=[{"AttributeName": "sub", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "sub", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        tables = (CATALOG_TABLE, PERFORMANCES_TABLE, SCORES_TABLE, GROUPS_TABLE, BOARD_TABLE)
        for name in (*tables, SOCIAL_TABLE, WRITEUPS_TABLE, EMAIL_TABLE, FAVORITES_TABLE):
            client.create_table(TableName=name, BillingMode="PAY_PER_REQUEST", **PK_SK)
        client.create_table(
            TableName=EVENTS_TABLE,
            BillingMode="PAY_PER_REQUEST",
            KeySchema=PK_SK["KeySchema"],
            AttributeDefinitions=[
                *PK_SK["AttributeDefinitions"],
                {"AttributeName": "uid", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "byUid",
                    "KeySchema": [
                        {"AttributeName": "uid", "KeyType": "HASH"},
                        {"AttributeName": "sk", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
        )
        boto3.client("s3").create_bucket(Bucket=AVATARS_BUCKET)
        yield boto3.resource("dynamodb")


ADMIN_EMAILS_PARAM = "/armchair/admin-emails"


@pytest.fixture
def admins(aws, monkeypatch):
    """The admin list at a placeholder nobody matches, as before the secret is set."""
    monkeypatch.setenv("ADMIN_EMAILS_PARAM", ADMIN_EMAILS_PARAM)
    boto3.client("ssm").put_parameter(Name=ADMIN_EMAILS_PARAM, Type="StringList", Value="unset")


def set_admins(value: str) -> None:
    boto3.client("ssm").put_parameter(
        Name=ADMIN_EMAILS_PARAM, Type="StringList", Value=value, Overwrite=True
    )


@pytest.fixture
def people(aws):
    """Three signed-in users, each with a profile and a search row."""
    from tests.social import A, B, C, sign_in

    sign_in(A, "Ada Lovelace")
    sign_in(B, "Bea Arthur", picture=None)
    sign_in(C, "Adam Driver")


@pytest.fixture
def unsubscribe_secret(aws):
    """The SecureString common/unsubscribe.py signs with, and a fresh cache of it."""
    from lambdas.common import unsubscribe

    boto3.client("ssm").put_parameter(
        Name="/armchair/email-unsubscribe-secret", Type="SecureString", Value="test-secret"
    )
    unsubscribe._secret.cache_clear()
    yield
    unsubscribe._secret.cache_clear()


@pytest.fixture
def outbox(aws, unsubscribe_secret, monkeypatch):
    """Every send, unsent: production SES access, no admins, a stub in place of SES."""
    from lambdas.common import mailer

    monkeypatch.setenv("EMAIL_DOMAIN", "armchairjudge.com")
    monkeypatch.setenv("EMAIL_CONFIG_SET", "armchair-mail")
    monkeypatch.setattr(mailer, "production", lambda: True)
    monkeypatch.setattr(mailer, "_admins", lambda: frozenset())
    sent = []

    def send(address, sub, show, kind, email):
        sent.append({"to": address, "sub": sub, "show": show, "kind": kind, "email": email})

    monkeypatch.setattr(mailer, "send", send)
    return sent
