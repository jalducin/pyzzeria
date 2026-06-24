## Context

POS demo mínimo: 3 tablas (products, sales, sale_items), sin autenticación, sin métodos de pago.
El backend sirve también el frontend vía StaticFiles para simplificar el despliegue.

## Goals / Non-Goals

**Goals:**
- API REST que valide stock y registre ventas de forma atómica.
- Frontend vainilla que muestre el catálogo y permita armar y confirmar un ticket.
- Snapshot de precio/nombre en sale_items para inmutabilidad del historial.

**Non-Goals:**
- Autenticación de cajeros.
- Métodos de pago (efectivo/tarjeta) y cálculo de cambio.
- Impresión física de ticket.
- Devoluciones / cancelaciones.
- ORM o migraciones (SQLite + script seed es suficiente para el dominio).

## Decisions

**Sin ORM — sqlite3 nativo**
Con 3 tablas y queries simples, `sqlite3.Row` es más legible que un ORM. Se reconsideraría
a partir de 6+ tablas o relaciones complejas.

**Validación de stock en el servidor, no en el cliente**
El frontend muestra stock "optimista" (descuenta lo que está en el carrito local), pero la fuente
de verdad está en el backend. Si dos cajeros compiten por el mismo producto, el segundo
`POST /api/sales` falla con HTTP 409; nunca hay estado inconsistente en la DB.

**Transacción única para venta + items + descuento de stock**
`CREATE sale → INSERT sale_items → UPDATE products.stock` ocurre en una sola transacción SQLite.
Ante cualquier fallo se hace rollback completo.

**Snapshot de precio/nombre en sale_items**
Las columnas `name` y `price` en `sale_items` son redundantes (también está `product_id`), pero
son intencionales: permiten que el historial sea inmutable ante cambios futuros del catálogo.

**Frontend servido por FastAPI StaticFiles**
Evita un servidor separado y simplifica el despliegue local. En producción se podría servir
desde S3/CDN sin cambiar el backend.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|-----------|
| Concurrencia SQLite bajo carga alta | Aceptable para demo; en producción usar PostgreSQL con `SELECT FOR UPDATE`. |
| Sin autenticación | Fuera de alcance explícito; cualquier extensión debe actualizar el spec primero. |
| Lógica de negocio inline en main.py | Correcto para el tamaño del dominio; extraer a service layer si crece. |

## Schema de base de datos

```sql
CREATE TABLE products (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT    NOT NULL,
    price    REAL    NOT NULL CHECK(price >= 0),
    stock    INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
    category TEXT    DEFAULT 'General'
);

CREATE TABLE sales (
    id         INTEGER   PRIMARY KEY AUTOINCREMENT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total      REAL      NOT NULL
);

CREATE TABLE sale_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id    INTEGER NOT NULL REFERENCES sales(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    name       TEXT    NOT NULL,
    price      REAL    NOT NULL,
    quantity   INTEGER NOT NULL CHECK(quantity > 0),
    subtotal   REAL    NOT NULL
);
```

## Contrato API (openapi.yaml)

Los endpoints implementados son:

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/products | Listar productos (filtro `?category=`) |
| GET | /api/categories | Listar categorías disponibles |
| POST | /api/sales | Registrar venta (201/404/409/422) |
| GET | /api/sales | Historial reciente (`?limit=20`) |
| GET | /api/sales/{id} | Detalle de una venta (200/404) |

## Estructura de archivos

```
pos-retail-sdd/
  backend/
    database.py   # schema DDL + seed de productos
    main.py       # FastAPI app: rutas + lógica de negocio
  frontend/
    index.html    # grid de productos + panel de ticket
    style.css     # tema "cinta de recibo"
    app.js        # estado del carrito, fetch a la API, render reactivo
  openspec/
    specs/pos-venta/  # este spec
  docs/
  ai-specs/
```
