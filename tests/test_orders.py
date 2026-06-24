import pytest


VALID_PAYLOAD = {"customer_name": "Test User", "size_id": 2, "topping_ids": [7, 3]}


def test_create_order_exitoso_retorna_201(client):
    resp = client.post("/api/orders", json=VALID_PAYLOAD)
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert data["status"] == "recibido"
    assert data["total"] == 179.00
    assert data["size_snapshot"]["name"] == "mediana"


def test_create_order_sin_toppings(client):
    resp = client.post("/api/orders", json={"customer_name": "Sin Extras", "size_id": 1, "topping_ids": []})
    assert resp.status_code == 201
    assert resp.json()["total"] == 89.00


def test_create_order_size_invalido_retorna_404(client):
    resp = client.post("/api/orders", json={"customer_name": "X", "size_id": 99, "topping_ids": []})
    assert resp.status_code == 404
    assert "Tamaño" in resp.json()["detail"]


def test_create_order_topping_invalido_retorna_404(client):
    resp = client.post("/api/orders", json={"customer_name": "X", "size_id": 1, "topping_ids": [99]})
    assert resp.status_code == 404
    assert "99" in resp.json()["detail"]


def test_create_order_demasiados_toppings_retorna_422(client):
    resp = client.post("/api/orders", json={"customer_name": "X", "size_id": 1, "topping_ids": list(range(1, 10))})
    assert resp.status_code == 422


def test_create_order_nombre_vacio_retorna_422(client):
    resp = client.post("/api/orders", json={"customer_name": "", "size_id": 1, "topping_ids": []})
    assert resp.status_code == 422


def test_create_order_toppings_duplicados_retorna_422(client):
    resp = client.post("/api/orders", json={"customer_name": "X", "size_id": 1, "topping_ids": [7, 7]})
    assert resp.status_code == 422


def test_get_order_existente(client):
    created = client.post("/api/orders", json=VALID_PAYLOAD).json()
    resp = client.get(f"/api/orders/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_order_inexistente_retorna_404(client):
    resp = client.get("/api/orders/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


def test_list_orders_by_status(client):
    client.post("/api/orders", json=VALID_PAYLOAD)
    resp = client.get("/api/orders?status=recibido")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
    assert all(o["status"] == "recibido" for o in resp.json())


def test_snapshot_inmutabilidad(client):
    resp = client.post("/api/orders", json={"customer_name": "Ana", "size_id": 2, "topping_ids": [7, 3]})
    data = resp.json()
    assert data["size_snapshot"]["base_price"] == 129.00
    topping_names = [t["name"] for t in data["topping_snapshots"]]
    assert "Pepperoni" in topping_names
    assert "Champiñones" in topping_names
