def test_list_sizes_returns_3_items(client):
    resp = client.get("/api/menu/sizes")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    names = [s["name"] for s in data]
    assert "chica" in names and "mediana" in names and "grande" in names


def test_list_sizes_ordered_by_price(client):
    resp = client.get("/api/menu/sizes")
    prices = [s["base_price"] for s in resp.json()]
    assert prices == sorted(prices)


def test_list_toppings_returns_10_items(client):
    resp = client.get("/api/menu/toppings")
    assert resp.status_code == 200
    assert len(resp.json()) == 10


def test_list_toppings_filter_by_category(client):
    resp = client.get("/api/menu/toppings?category=carnes")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 3
    assert all(t["category"] == "carnes" for t in items)


def test_list_toppings_unknown_category_returns_empty(client):
    resp = client.get("/api/menu/toppings?category=bebidas")
    assert resp.status_code == 200
    assert resp.json() == []
