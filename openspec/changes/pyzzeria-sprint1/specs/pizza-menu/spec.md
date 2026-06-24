# Spec — pizza-menu

## User Story

Como visitante del portafolio,
quiero ver el menú de Pyzzeria con tamaños y toppings disponibles y sus precios,
para poder armar mi pedido de pizza.

## Requirements

### REQ-01 — Tamaños de pizza

El sistema DEBE exponer los tres tamaños disponibles con su precio base y diámetro.

| id | name | diameter_cm | base_price |
|----|------|-------------|------------|
| 1 | chica | 25 | $89.00 |
| 2 | mediana | 30 | $129.00 |
| 3 | grande | 35 | $169.00 |

### REQ-02 — Toppings

El sistema DEBE exponer los toppings disponibles, agrupables por categoría.

| id | name | price | category |
|----|------|-------|----------|
| 1 | Extra mozzarella | $25 | quesos |
| 2 | Gorgonzola | $35 | quesos |
| 3 | Champiñones | $20 | vegetales |
| 4 | Pimiento morrón | $15 | vegetales |
| 5 | Cebolla caramelizada | $20 | vegetales |
| 6 | Aceitunas | $15 | vegetales |
| 7 | Pepperoni | $30 | carnes |
| 8 | Jamón | $25 | carnes |
| 9 | Chorizo italiano | $35 | carnes |
| 10 | Pesto | $25 | salsas |

### REQ-03 — Precio total en tiempo real

El frontend DEBE calcular y mostrar el precio total (base + toppings seleccionados)
de forma reactiva conforme el usuario selecciona o deselecciona toppings.
Cálculo: `total = size.base_price + sum(selected_toppings.price)`.

### REQ-04 — Filtro por categoría

El endpoint de toppings DEBE soportar filtrado por `?category=` para que el frontend
pueda agrupar visualmente por quesos / vegetales / carnes / salsas.

## Scenarios

### Scenario: Listar tamaños
WHEN se llama `GET /api/menu/sizes`
THEN responde HTTP 200 con array de 3 tamaños ordenados de menor a mayor precio

### Scenario: Listar toppings sin filtro
WHEN se llama `GET /api/menu/toppings`
THEN responde HTTP 200 con los 10 toppings

### Scenario: Listar toppings por categoría
WHEN se llama `GET /api/menu/toppings?category=carnes`
THEN responde HTTP 200 con solo los toppings de categoría "carnes"

### Scenario: Categoría inexistente
WHEN se llama `GET /api/menu/toppings?category=bebidas`
THEN responde HTTP 200 con array vacío (no es error)

### Scenario: Precio reactivo en frontend
WHEN el visitante selecciona tamaño mediana ($129) + pepperoni ($30) + champiñones ($20)
THEN el frontend muestra "$179.00" sin recargar la página
