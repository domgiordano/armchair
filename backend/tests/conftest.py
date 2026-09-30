import boto3
import pytest
from moto import mock_aws

USERS_TABLE = "t-armchair-users"
CATALOG_TABLE = "t-armchair-catalog"
PERFORMANCES_TABLE = "t-armchair-performances"
SCORES_TABLE = "t-armchair-scores"
GROUPS_TABLE = "t-armchair-groups"

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
        "APP_NAME": "armchair",
        "CORS_ALLOW_ORIGIN": "https://dwts.armchairjudge.com,http://localhost:3000",
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
        for name in (CATALOG_TABLE, PERFORMANCES_TABLE, SCORES_TABLE, GROUPS_TABLE):
            client.create_table(TableName=name, BillingMode="PAY_PER_REQUEST", **PK_SK)
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
