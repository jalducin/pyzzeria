"""
Seed 3 pedidos demo en DynamoDB. No inicia Step Functions — los pedidos quedan "congelados".

Uso:
    python scripts/seed.py --table-name pyzzeria-orders --region us-east-2
"""
import argparse
import uuid
from decimal import Decimal
from datetime import datetime, timezone

import boto3


def _to_decimal(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_decimal(v) for v in obj]
    return obj


SEED_ORDERS = [
    {
        "customer_name": "Ana García",
        "size_snapshot": {"id": 2, "name": "mediana", "diameter_cm": 30, "base_price": 129.00},
        "topping_snapshots": [
            {"id": 7, "name": "Pepperoni",   "price": 30.00, "category": "carnes"},
            {"id": 3, "name": "Champiñones", "price": 20.00, "category": "vegetales"},
        ],
        "total": "179.00",
        "status": "horno",
    },
    {
        "customer_name": "Carlos Ruiz",
        "size_snapshot": {"id": 3, "name": "grande", "diameter_cm": 35, "base_price": 169.00},
        "topping_snapshots": [
            {"id": 1, "name": "Extra mozzarella", "price": 25.00, "category": "quesos"},
            {"id": 2, "name": "Gorgonzola",        "price": 35.00, "category": "quesos"},
            {"id": 6, "name": "Aceitunas",          "price": 15.00, "category": "vegetales"},
        ],
        "total": "244.00",
        "status": "preparando",
    },
    {
        "customer_name": "Demo User",
        "size_snapshot": {"id": 1, "name": "chica", "diameter_cm": 25, "base_price": 89.00},
        "topping_snapshots": [
            {"id": 7, "name": "Pepperoni", "price": 30.00, "category": "carnes"},
        ],
        "total": "119.00",
        "status": "listo",
    },
]


def seed(table_name: str, region: str) -> None:
    dynamodb = boto3.resource("dynamodb", region_name=region)
    table = dynamodb.Table(table_name)

    now = datetime.now(timezone.utc).isoformat()

    for order in SEED_ORDERS:
        item = {
            "orderId": str(uuid.uuid4()),
            "customer_name": order["customer_name"],
            "size_snapshot": order["size_snapshot"],
            "topping_snapshots": order["topping_snapshots"],
            "total": order["total"],
            "status": order["status"],
            "isSeed": True,
            "created_at": now,
            "updated_at": now,
            "estimated_seconds": None,
        }
        table.put_item(Item=_to_decimal(item))
        print(f"  OK {order['customer_name']} - {order['status']}")

    print(f"\n3 pedidos seed insertados en '{table_name}'.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Pyzzeria DynamoDB")
    parser.add_argument("--table-name", required=True)
    parser.add_argument("--region", default="us-east-2")
    args = parser.parse_args()
    seed(args.table_name, args.region)
