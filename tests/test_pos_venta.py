"""
Tests — spec: openspec/specs/pos-venta/spec.md
Cubre todos los escenarios definidos en el spec.
"""
import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Catálogo
# ---------------------------------------------------------------------------

def test_listar_productos_devuelve_lista(client: TestClient):
    """Escenario: Listar productos — devuelve al menos los productos seed."""
    res = client.get("/api/products")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 5
    producto = data[0]
    assert {"id", "name", "price", "stock", "category"} <= producto.keys()


def test_listar_productos_filtro_por_categoria(client: TestClient):
    """Escenario: Filtrar por categoría — solo devuelve productos de esa categoría."""
    res = client.get("/api/products?category=Bebidas")
    assert res.status_code == 200
    data = res.json()
    assert all(p["category"] == "Bebidas" for p in data)
    assert len(data) > 0


def test_listar_productos_categoria_inexistente_devuelve_lista_vacia(client: TestClient):
    res = client.get("/api/products?category=Inexistente")
    assert res.status_code == 200
    assert res.json() == []


def test_listar_categorias(client: TestClient):
    """Escenario: Listar categorías — devuelve lista de strings únicos."""
    res = client.get("/api/categories")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert "Bebidas" in data
    assert "Comida" in data
    assert len(data) == len(set(data))  # sin duplicados


# ---------------------------------------------------------------------------
# Ventas — happy path
# ---------------------------------------------------------------------------

def test_crear_venta_exitosa_retorna_201(client: TestClient):
    """Escenario: Venta exitosa — 201 con folio, total y snapshot."""
    res = client.post("/api/sales", json={"items": [{"product_id": 1, "quantity": 2}]})
    assert res.status_code == 201
    data = res.json()
    assert "id" in data
    assert "total" in data
    assert "created_at" in data
    assert len(data["items"]) == 1
    item = data["items"][0]
    assert item["quantity"] == 2
    assert item["subtotal"] == round(item["price"] * 2, 2)


def test_crear_venta_descuenta_stock(client: TestClient):
    """Escenario: Venta exitosa — el stock del producto disminuye exactamente en la cantidad vendida."""
    stock_antes = client.get("/api/products").json()
    producto = next(p for p in stock_antes if p["id"] == 3)  # Agua mineral
    stock_previo = producto["stock"]

    client.post("/api/sales", json={"items": [{"product_id": 3, "quantity": 1}]})

    stock_despues = client.get("/api/products").json()
    producto_post = next(p for p in stock_despues if p["id"] == 3)
    assert producto_post["stock"] == stock_previo - 1


def test_crear_venta_snapshot_precio_nombre(client: TestClient):
    """Escenario: Snapshot — los items guardan precio y nombre del momento de la venta."""
    productos = client.get("/api/products").json()
    p = next(x for x in productos if x["id"] == 2)  # Café con leche

    res = client.post("/api/sales", json={"items": [{"product_id": 2, "quantity": 1}]})
    assert res.status_code == 201
    item = res.json()["items"][0]
    assert item["name"] == p["name"]
    assert item["price"] == p["price"]


def test_crear_venta_multiples_items(client: TestClient):
    """Venta con varios productos distintos — total es suma de subtotales."""
    res = client.post(
        "/api/sales",
        json={"items": [{"product_id": 1, "quantity": 1}, {"product_id": 4, "quantity": 2}]},
    )
    assert res.status_code == 201
    data = res.json()
    total_esperado = round(sum(i["subtotal"] for i in data["items"]), 2)
    assert data["total"] == total_esperado


# ---------------------------------------------------------------------------
# Ventas — casos de error
# ---------------------------------------------------------------------------

def test_crear_venta_carrito_vacio_retorna_422(client: TestClient):
    """Escenario: Carrito vacío — HTTP 422."""
    res = client.post("/api/sales", json={"items": []})
    assert res.status_code == 422


def test_crear_venta_producto_inexistente_retorna_404(client: TestClient):
    """Escenario: Producto inexistente — HTTP 404, DB sin cambios."""
    res = client.post("/api/sales", json={"items": [{"product_id": 9999, "quantity": 1}]})
    assert res.status_code == 404


def test_crear_venta_stock_insuficiente_retorna_409(client: TestClient):
    """Escenario: Stock insuficiente — HTTP 409, DB sin cambios."""
    res = client.post("/api/sales", json={"items": [{"product_id": 1, "quantity": 9999}]})
    assert res.status_code == 409


def test_crear_venta_stock_insuficiente_no_modifica_db(client: TestClient):
    """Escenario: Stock insuficiente — ningún producto pierde stock."""
    stock_antes = {p["id"]: p["stock"] for p in client.get("/api/products").json()}

    client.post(
        "/api/sales",
        json={"items": [
            {"product_id": 1, "quantity": 1},       # válido
            {"product_id": 5, "quantity": 99999},    # inválido — agota el rollback
        ]},
    )

    stock_despues = {p["id"]: p["stock"] for p in client.get("/api/products").json()}
    assert stock_antes == stock_despues


def test_crear_venta_quantity_cero_retorna_422(client: TestClient):
    res = client.post("/api/sales", json={"items": [{"product_id": 1, "quantity": 0}]})
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# Historial de ventas
# ---------------------------------------------------------------------------

def test_historial_ventas_devuelve_lista(client: TestClient):
    """Escenario: Ver historial reciente."""
    res = client.get("/api/sales")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_historial_ventas_limite(client: TestClient):
    res = client.get("/api/sales?limit=2")
    assert res.status_code == 200
    assert len(res.json()) <= 2


def test_detalle_venta_existente(client: TestClient):
    """Escenario: Ver detalle de venta — devuelve venta con items."""
    crear = client.post("/api/sales", json={"items": [{"product_id": 1, "quantity": 1}]})
    sale_id = crear.json()["id"]

    res = client.get(f"/api/sales/{sale_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == sale_id
    assert len(data["items"]) == 1


def test_detalle_venta_inexistente_retorna_404(client: TestClient):
    """Escenario: Venta no encontrada — HTTP 404."""
    res = client.get("/api/sales/999999")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Swagger / OpenAPI (regla de oro)
# ---------------------------------------------------------------------------

def test_openapi_json_accesible(client: TestClient):
    """Regla de oro: /openapi.json debe responder 200."""
    res = client.get("/openapi.json")
    assert res.status_code == 200
    schema = res.json()
    assert schema["info"]["title"] == "POS API"


def test_swagger_docs_accesible(client: TestClient):
    """Regla de oro: /docs debe responder 200."""
    res = client.get("/docs")
    assert res.status_code == 200
