SIZES = [
    {"id": 1, "name": "chica",   "diameter_cm": 25, "base_price": 89.00},
    {"id": 2, "name": "mediana", "diameter_cm": 30, "base_price": 129.00},
    {"id": 3, "name": "grande",  "diameter_cm": 35, "base_price": 169.00},
]

TOPPINGS = [
    {"id": 1,  "name": "Extra mozzarella",    "price": 25.00, "category": "quesos"},
    {"id": 2,  "name": "Gorgonzola",          "price": 35.00, "category": "quesos"},
    {"id": 3,  "name": "Champiñones",         "price": 20.00, "category": "vegetales"},
    {"id": 4,  "name": "Pimiento morrón",     "price": 15.00, "category": "vegetales"},
    {"id": 5,  "name": "Cebolla caramelizada","price": 20.00, "category": "vegetales"},
    {"id": 6,  "name": "Aceitunas",           "price": 15.00, "category": "vegetales"},
    {"id": 7,  "name": "Pepperoni",           "price": 30.00, "category": "carnes"},
    {"id": 8,  "name": "Jamón",              "price": 25.00, "category": "carnes"},
    {"id": 9,  "name": "Chorizo italiano",    "price": 35.00, "category": "carnes"},
    {"id": 10, "name": "Pesto",              "price": 25.00, "category": "salsas"},
]

_sizes_by_id   = {s["id"]: s for s in SIZES}
_toppings_by_id = {t["id"]: t for t in TOPPINGS}


def get_size(size_id: int) -> dict | None:
    return _sizes_by_id.get(size_id)


def get_topping(topping_id: int) -> dict | None:
    return _toppings_by_id.get(topping_id)


def get_toppings_by_category(category: str) -> list[dict]:
    return [t for t in TOPPINGS if t["category"] == category]
