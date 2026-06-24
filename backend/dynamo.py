import os
import time
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr


def _to_decimal(obj):
    """Convierte floats a Decimal recursivamente (requerido por DynamoDB boto3 resource)."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_decimal(i) for i in obj]
    return obj


def _from_decimal(obj):
    """Convierte Decimal a float recursivamente para serialización JSON."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _from_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_from_decimal(i) for i in obj]
    return obj


def _table(env_var: str):
    dynamodb = boto3.resource("dynamodb")
    return dynamodb.Table(os.environ[env_var])


def get_orders_table():
    return _table("ORDERS_TABLE")


def get_connections_table():
    return _table("WS_CONNECTIONS_TABLE")


def create_order(order_dict: dict) -> None:
    get_orders_table().put_item(Item=_to_decimal(order_dict))


def get_order(order_id: str) -> dict | None:
    resp = get_orders_table().get_item(Key={"orderId": order_id})
    item = resp.get("Item")
    return _from_decimal(item) if item else None


def update_order_status(order_id: str, status: str) -> None:
    from datetime import datetime, timezone
    get_orders_table().update_item(
        Key={"orderId": order_id},
        UpdateExpression="SET #s = :s, updatedAt = :ts",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":s": status,
            ":ts": datetime.now(timezone.utc).isoformat(),
        },
    )


def list_orders_by_status(statuses: list[str]) -> list[dict]:
    if not statuses:
        return []
    table = get_orders_table()
    filter_expr = None
    for s in statuses:
        cond = Attr("status").eq(s)
        filter_expr = cond if filter_expr is None else filter_expr | cond
    resp = table.scan(FilterExpression=filter_expr)
    return [_from_decimal(item) for item in resp.get("Items", [])]


def save_connection(connection_id: str, order_id: str, ttl_seconds: int = 7200) -> None:
    get_connections_table().put_item(Item={
        "connectionId": connection_id,
        "orderId": order_id,
        "ttl": int(time.time()) + ttl_seconds,
    })


def delete_connection(connection_id: str) -> None:
    get_connections_table().delete_item(Key={"connectionId": connection_id})


def get_connections_for_order(order_id: str) -> list[dict]:
    resp = get_connections_table().scan(
        FilterExpression=Attr("orderId").eq(order_id)
    )
    return resp.get("Items", [])
