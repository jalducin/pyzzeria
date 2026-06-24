import os

import boto3
import pytest
from fastapi.testclient import TestClient
from moto import mock_aws


# Variables de entorno requeridas antes de importar los módulos
os.environ.setdefault("ORDERS_TABLE",         "test-orders")
os.environ.setdefault("WS_CONNECTIONS_TABLE", "test-ws-connections")
os.environ.setdefault("STATE_MACHINE_ARN",    "arn:aws:states:us-east-2:123456789012:stateMachine:test")
os.environ.setdefault("AWS_DEFAULT_REGION",   "us-east-2")
os.environ.setdefault("AWS_ACCESS_KEY_ID",    "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY","testing")


def _create_tables():
    ddb = boto3.resource("dynamodb", region_name="us-east-2")
    ddb.create_table(
        TableName="test-orders",
        KeySchema=[{"AttributeName": "orderId", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "orderId", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )
    ddb.create_table(
        TableName="test-ws-connections",
        KeySchema=[{"AttributeName": "connectionId", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "connectionId", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )


@pytest.fixture
def aws_mock():
    with mock_aws():
        _create_tables()
        yield


@pytest.fixture
def client(aws_mock):
    from backend.main import app
    return TestClient(app)
