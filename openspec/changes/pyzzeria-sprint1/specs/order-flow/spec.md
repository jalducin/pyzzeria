# Spec — order-flow

## User Story

Como visitante del portafolio,
quiero crear un pedido de pizza eligiendo tamaño, toppings y dejando mi nombre ficticio,
para ver el sistema en acción sin necesidad de cuenta ni pago.

## Requirements

### REQ-01 — Creación de pedido sin autenticación

El sistema DEBE aceptar pedidos sin token ni sesión. El único identificador del cliente
es `customer_name` (texto libre, 1–50 caracteres).

### REQ-02 — Payload del pedido

```json
{
  "customer_name": "Ana García",
  "size_id": 2,
  "topping_ids": [7, 3]
}
```

- `size_id` DEBE corresponder a un tamaño existente (1, 2 o 3)
- `topping_ids` puede ser lista vacía (pizza sin toppings extra)
- `topping_ids` no puede contener IDs duplicados
- Máximo 8 toppings por pedido

### REQ-03 — Snapshot inmutable

Al crear el pedido, el sistema DEBE guardar `name` y `price` del tamaño y de cada topping
tal como están en ese momento (snapshot). Los datos del pedido NO cambian si el menú cambia.

### REQ-04 — Total calculado en servidor

El total se calcula y persiste en el servidor: `total = size.base_price + sum(toppings.price)`.
El frontend no envía el total — solo los IDs.

### REQ-05 — Estado inicial

Todo pedido nuevo inicia en estado `recibido` y tiene un UUID como identificador.

### REQ-06 — Respuesta completa

La respuesta HTTP 201 incluye el `id` del pedido (UUID) y todos los datos necesarios
para iniciar el tracker (estado, snapshots, total, timestamps).

### REQ-07 — Validaciones y errores

| Condición | HTTP | Mensaje |
|-----------|------|---------|
| `size_id` no existe | 404 | "Tamaño no disponible" |
| `topping_ids` contiene ID inexistente | 404 | "Topping {id} no disponible" |
| `customer_name` vacío o > 50 chars | 422 | error de validación Pydantic |
| `topping_ids` con duplicados | 422 | "Toppings duplicados no permitidos" |
| Más de 8 toppings | 422 | "Máximo 8 toppings por pizza" |

## Scenarios

### Scenario: Pedido exitoso
WHEN `POST /api/orders` con `customer_name="Ana"`, `size_id=2`, `topping_ids=[7,3]`
THEN responde HTTP 201 con `id` (UUID), `status="recibido"`, `total=179.00`,
     `sizeSnapshot.name="mediana"`, `toppingSnapshots` contiene pepperoni y champiñones

### Scenario: Pizza sin toppings extra
WHEN `POST /api/orders` con `topping_ids=[]`
THEN responde HTTP 201 con `total` igual al precio base del tamaño

### Scenario: Tamaño inválido
WHEN `POST /api/orders` con `size_id=99`
THEN responde HTTP 404 con detalle "Tamaño no disponible"

### Scenario: Topping inválido
WHEN `POST /api/orders` con `topping_ids=[99]`
THEN responde HTTP 404 con detalle "Topping 99 no disponible"

### Scenario: Demasiados toppings
WHEN `POST /api/orders` con `topping_ids` de 9 elementos
THEN responde HTTP 422

### Scenario: Nombre vacío
WHEN `POST /api/orders` con `customer_name=""`
THEN responde HTTP 422

### Scenario: Consultar pedido existente
WHEN `GET /api/orders/{id}` con UUID válido
THEN responde HTTP 200 con el pedido completo incluyendo estado actual

### Scenario: Consultar pedido inexistente
WHEN `GET /api/orders/{id}` con UUID desconocido
THEN responde HTTP 404

### Scenario: Listar pedidos activos
WHEN `GET /api/orders?status=recibido,preparando,horno`
THEN responde HTTP 200 con array de pedidos en esos estados (para panel cocina)
