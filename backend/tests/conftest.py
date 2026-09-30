import json

import boto3
import pytest
from moto import mock_aws

USERS_TABLE = "t-armchair-users"


@pytest.fixture
def aws(monkeypatch):
    """A moto account with the tables Terraform creates."""
    for k, v in {
        "AWS_REGION": "us-east-1",
        "AWS_DEFAULT_REGION": "us-east-1",
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
        "USERS_TABLE": USERS_TABLE,
        "APP_NAME": "armchair",
        "CORS_ALLOW_ORIGIN": "https://dwts.xomware.com,http://localhost:3000",
    }.items():
        monkeypatch.setenv(k, v)
    with mock_aws():
        boto3.client("dynamodb").create_table(
            TableName=USERS_TABLE,
            KeySchema=[{"AttributeName": "sub", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "sub", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        yield boto3.resource("dynamodb")


CATALOG_TABLE = "t-armchair-catalog"
ADMIN_EMAILS_PARAM = "/armchair/admin-emails"


@pytest.fixture
def catalog(aws, monkeypatch):
    """The catalog seeded with S35 as seed_season writes it, and an admin list nobody is on."""
    from scripts.seed_season import SEASONS, items, write

    monkeypatch.setenv("CATALOG_TABLE", CATALOG_TABLE)
    monkeypatch.setenv("ADMIN_EMAILS_PARAM", ADMIN_EMAILS_PARAM)
    table = aws.create_table(
        TableName=CATALOG_TABLE,
        KeySchema=[
            {"AttributeName": "pk", "KeyType": "HASH"},
            {"AttributeName": "sk", "KeyType": "RANGE"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "pk", "AttributeType": "S"},
            {"AttributeName": "sk", "AttributeType": "S"},
        ],
        BillingMode="PAY_PER_REQUEST",
    )
    write(table, items(json.loads((SEASONS / "dwts-35.json").read_text())))
    boto3.client("ssm").put_parameter(Name=ADMIN_EMAILS_PARAM, Type="StringList", Value="unset")
    return table


def set_admins(value: str) -> None:
    boto3.client("ssm").put_parameter(
        Name=ADMIN_EMAILS_PARAM, Type="StringList", Value=value, Overwrite=True
    )
