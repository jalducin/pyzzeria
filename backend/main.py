import os
from contextlib import asynccontextmanager, contextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .database import get_connection, init_db


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="POS API",
    version="1.0.0",
    description=(
        "API de Punto de Venta demo — Spec-Driven Development.\n\n"
        "**Nota de autenticación**: la autenticación de cajeros está fuera de alcance en v1 "
        "(ver `openspec/specs/pos-venta/spec.md`). Todos los endpoints son públicos en esta versión."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ProductResponse(BaseModel):
    id: int
    name: str
    price: float
    stock: int
    category: str


class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, description="Cantidad solicitada (mínimo 1)")


class SaleCreate(BaseModel):
    items: list[SaleItemCreate] = Field(min_length=1, description="Items del carrito (al menos 1)")


class SaleItemResponse(BaseModel):
    product_id: int
    name: str
    price: float
    quantity: int
    subtotal: float


class SaleResponse(BaseModel):
    id: int
    created_at: str
    total: float
    items: list[SaleItemResponse]


# ---------------------------------------------------------------------------
# Endpoints — Catálogo
# ---------------------------------------------------------------------------

@app.get(
    "/api/products",
    response_model=list[ProductResponse],
    summary="Listar productos",
    description="Devuelve todos los productos. Filtrar por categoría con `?category=Bebidas`.",
    tags=["Catálogo"],
)
def list_products(category: Optional[str] = None) -> list[dict]:
    with get_db() as conn:
        if category:
            rows = conn.execute(
                "SELECT id, name, price, stock, category FROM products WHERE category = ?",
                (category,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, name, price, stock, category FROM products"
            ).fetchall()
        return [dict(r) for r in rows]


@app.get(
    "/api/categories",
    response_model=list[str],
    summary="Listar categorías disponibles",
    tags=["Catálogo"],
)
def list_categories() -> list[str]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT category FROM products ORDER BY category"
        ).fetchall()
        return [r["category"] for r in rows]


# ---------------------------------------------------------------------------
# Endpoints — Ventas
# ---------------------------------------------------------------------------

@app.post(
    "/api/sales",
    response_model=SaleResponse,
    status_code=201,
    summary="Registrar venta",
    description=(
        "Valida stock de todos los items antes de crear nada. "
        "Si algún producto no tiene stock suficiente se rechaza toda la venta (HTTP 409). "
        "La creación de la venta, los items y el descuento de stock ocurren en una transacción atómica."
    ),
    responses={
        404: {"description": "Producto no existe"},
        409: {"description": "Stock insuficiente para uno o más productos"},
        422: {"description": "Carrito vacío o datos inválidos"},
    },
    tags=["Ventas"],
)
def create_sale(payload: SaleCreate) -> dict:
    with get_db() as conn:
        # Validar todos los items antes de escribir nada
        enriched = []
        for item in payload.items:
            row = conn.execute(
                "SELECT id, name, price, stock FROM products WHERE id = ?",
                (item.product_id,),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Producto {item.product_id} no existe")
            if row["stock"] < item.quantity:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Stock insuficiente para '{row['name']}': "
                        f"disponible {row['stock']}, solicitado {item.quantity}"
                    ),
                )
            enriched.append(
                {
                    "product_id": item.product_id,
                    "name": row["name"],
                    "price": row["price"],
                    "quantity": item.quantity,
                    "subtotal": round(row["price"] * item.quantity, 2),
                }
            )

        total = round(sum(e["subtotal"] for e in enriched), 2)

        # Transacción atómica: INSERT sale + items + UPDATE stock
        try:
            conn.execute("BEGIN")
            cur = conn.execute("INSERT INTO sales (total) VALUES (?)", (total,))
            sale_id = cur.lastrowid

            for e in enriched:
                conn.execute(
                    "INSERT INTO sale_items (sale_id, product_id, name, price, quantity, subtotal) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (sale_id, e["product_id"], e["name"], e["price"], e["quantity"], e["subtotal"]),
                )
                conn.execute(
                    "UPDATE products SET stock = stock - ? WHERE id = ?",
                    (e["quantity"], e["product_id"]),
                )
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise

        sale_row = conn.execute(
            "SELECT id, created_at, total FROM sales WHERE id = ?", (sale_id,)
        ).fetchone()

        return {
            "id": sale_row["id"],
            "created_at": sale_row["created_at"],
            "total": sale_row["total"],
            "items": enriched,
        }


@app.get(
    "/api/sales",
    response_model=list[SaleResponse],
    summary="Historial de ventas",
    description="Devuelve las últimas ventas. Por defecto las 20 más recientes.",
    tags=["Ventas"],
)
def list_sales(limit: int = 20) -> list[dict]:
    with get_db() as conn:
        sales = conn.execute(
            "SELECT id, created_at, total FROM sales ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()

        result = []
        for s in sales:
            items = conn.execute(
                "SELECT product_id, name, price, quantity, subtotal FROM sale_items WHERE sale_id = ?",
                (s["id"],),
            ).fetchall()
            result.append(
                {
                    "id": s["id"],
                    "created_at": s["created_at"],
                    "total": s["total"],
                    "items": [dict(i) for i in items],
                }
            )
        return result


@app.get(
    "/api/sales/{sale_id}",
    response_model=SaleResponse,
    summary="Detalle de una venta",
    responses={404: {"description": "Venta no encontrada"}},
    tags=["Ventas"],
)
def get_sale(sale_id: int) -> dict:
    with get_db() as conn:
        sale = conn.execute(
            "SELECT id, created_at, total FROM sales WHERE id = ?", (sale_id,)
        ).fetchone()
        if not sale:
            raise HTTPException(status_code=404, detail="Venta no encontrada")
        items = conn.execute(
            "SELECT product_id, name, price, quantity, subtotal FROM sale_items WHERE sale_id = ?",
            (sale_id,),
        ).fetchall()
        return {
            "id": sale["id"],
            "created_at": sale["created_at"],
            "total": sale["total"],
            "items": [dict(i) for i in items],
        }


# ---------------------------------------------------------------------------
# Frontend (debe ir al final para no sobrepisar rutas /api/*)
# ---------------------------------------------------------------------------

_frontend = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(_frontend):
    app.mount("/", StaticFiles(directory=_frontend, html=True), name="frontend")
