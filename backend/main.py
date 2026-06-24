import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import boto3
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from pydantic import BaseModel, Field, field_validator

from .dynamo import (
    create_order,
    get_order,
    list_orders_by_status,
)
from .menu import SIZES, TOPPINGS, get_size, get_topping, get_toppings_by_category

app = FastAPI(
    title="Pyzzeria API",
    version="1.0.0",
    description=(
        "API serverless de pedidos de pizza — demo de portafolio.\n\n"
        "**Stack**: AWS Lambda + API Gateway + DynamoDB + Step Functions.\n\n"
        "**Autenticación**: fuera de alcance en v1 — todos los endpoints son públicos "
        "(demo sin datos sensibles ni pagos reales)."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SizeResponse(BaseModel):
    id: int
    name: str
    diameter_cm: int
    base_price: float


class ToppingResponse(BaseModel):
    id: int
    name: str
    price: float
    category: str


class SizeSnapshot(BaseModel):
    id: int
    name: str
    diameter_cm: int
    base_price: float


class ToppingSnapshot(BaseModel):
    id: int
    name: str
    price: float
    category: str


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=50)
    size_id: int
    topping_ids: list[int] = Field(default_factory=list)

    @field_validator("topping_ids")
    @classmethod
    def no_duplicates(cls, v: list[int]) -> list[int]:
        if len(v) != len(set(v)):
            raise ValueError("Toppings duplicados no permitidos")
        if len(v) > 8:
            raise ValueError("Máximo 8 toppings por pizza")
        return v


class OrderResponse(BaseModel):
    id: str
    customer_name: str
    size_snapshot: SizeSnapshot
    topping_snapshots: list[ToppingSnapshot]
    total: float
    status: str
    created_at: str
    updated_at: str
    estimated_seconds: Optional[int] = None


# ---------------------------------------------------------------------------
# Endpoints — Menú
# ---------------------------------------------------------------------------

@app.get(
    "/api/menu/sizes",
    response_model=list[SizeResponse],
    summary="Listar tamaños de pizza",
    description="Devuelve los 3 tamaños disponibles ordenados de menor a mayor precio.",
    tags=["Menú"],
)
def list_sizes() -> list[dict]:
    return SIZES


@app.get(
    "/api/menu/toppings",
    response_model=list[ToppingResponse],
    summary="Listar toppings disponibles",
    description="Devuelve los 10 toppings. Filtrar por categoría con `?category=carnes`.",
    tags=["Menú"],
)
def list_toppings(category: Optional[str] = None) -> list[dict]:
    if category:
        return get_toppings_by_category(category)
    return TOPPINGS


# ---------------------------------------------------------------------------
# Endpoints — Pedidos
# ---------------------------------------------------------------------------

@app.post(
    "/api/orders",
    response_model=OrderResponse,
    status_code=201,
    summary="Crear pedido",
    description=(
        "Crea un pedido nuevo. El total se calcula en el servidor. "
        "Los snapshots de tamaño y toppings son inmutables — si el menú cambia, "
        "el pedido histórico conserva los valores originales. "
        "Al crear el pedido, se inicia automáticamente el Step Functions Express Workflow "
        "que simula las transiciones de estado en ~70 segundos."
    ),
    responses={
        404: {"description": "Tamaño o topping no disponible"},
        422: {"description": "Validación fallida (nombre vacío, toppings duplicados, más de 8 toppings)"},
    },
    tags=["Pedidos"],
)
def create_order_endpoint(payload: OrderCreate) -> dict:
    size = get_size(payload.size_id)
    if not size:
        raise HTTPException(status_code=404, detail="Tamaño no disponible")

    topping_snapshots = []
    for tid in payload.topping_ids:
        t = get_topping(tid)
        if not t:
            raise HTTPException(status_code=404, detail=f"Topping {tid} no disponible")
        topping_snapshots.append(t)

    total = round(size["base_price"] + sum(t["price"] for t in topping_snapshots), 2)
    now = datetime.now(timezone.utc).isoformat()
    order_id = str(uuid.uuid4())

    order = {
        "orderId": order_id,
        "customer_name": payload.customer_name,
        "size_snapshot": size,
        "topping_snapshots": topping_snapshots,
        "total": str(total),
        "status": "recibido",
        "created_at": now,
        "updated_at": now,
        "estimated_seconds": 8,
    }
    create_order(order)

    _start_state_machine(order_id)

    return {
        "id": order_id,
        "customer_name": order["customer_name"],
        "size_snapshot": size,
        "topping_snapshots": topping_snapshots,
        "total": total,
        "status": "recibido",
        "created_at": now,
        "updated_at": now,
        "estimated_seconds": 8,
    }


@app.get(
    "/api/orders/{order_id}",
    response_model=OrderResponse,
    summary="Obtener pedido por ID",
    description="Devuelve el estado actual del pedido. Útil como fallback cuando el WebSocket no está disponible.",
    responses={
        404: {"description": "Pedido no encontrado"},
    },
    tags=["Pedidos"],
)
def get_order_endpoint(order_id: str) -> dict:
    order = get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return _serialize_order(order)


@app.get(
    "/api/orders",
    response_model=list[OrderResponse],
    summary="Listar pedidos por estado",
    description=(
        "Devuelve pedidos filtrados por estado. "
        "Múltiples estados separados por coma: `?status=recibido,preparando,horno`"
    ),
    tags=["Pedidos"],
)
def list_orders(status: Optional[str] = None) -> list[dict]:
    statuses = status.split(",") if status else ["recibido", "preparando", "horno", "listo", "entregado"]
    orders = list_orders_by_status(statuses)
    return [_serialize_order(o) for o in orders]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize_order(order: dict) -> dict:
    return {
        "id": order["orderId"],
        "customer_name": order["customer_name"],
        "size_snapshot": order["size_snapshot"],
        "topping_snapshots": order.get("topping_snapshots", []),
        "total": float(order["total"]),
        "status": order["status"],
        "created_at": order["created_at"],
        "updated_at": order["updated_at"],
        "estimated_seconds": order.get("estimated_seconds"),
    }


def _start_state_machine(order_id: str) -> None:
    arn = os.environ.get("STATE_MACHINE_ARN")
    if not arn:
        return
    try:
        sfn = boto3.client("stepfunctions")
        sfn.start_execution(
            stateMachineArn=arn,
            input=json.dumps({"orderId": order_id}),
        )
    except Exception:
        pass  # no bloquear la respuesta al cliente si SFN falla (dev local / test)


# ---------------------------------------------------------------------------
# Mangum handler para Lambda
# ---------------------------------------------------------------------------
handler = Mangum(app, lifespan="off")
