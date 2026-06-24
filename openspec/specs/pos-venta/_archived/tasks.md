## 0. Setup

- [ ] 0.1 Crear feature branch: `git checkout -b feature/pos-venta`

## 1. Backend — Base de datos

- [ ] 1.1 Crear `backend/database.py` con DDL de las 3 tablas (products, sales, sale_items)
- [ ] 1.2 Agregar seed de 5 productos de prueba en `database.py`
- [ ] 1.3 Verificar que `python backend/database.py` crea el archivo `pos.db` con datos

## 2. Backend — Endpoints de catálogo

- [ ] 2.1 Crear `backend/main.py` con FastAPI app y `GET /api/products` (lista + filtro por categoría)
- [ ] 2.2 Agregar `GET /api/categories` — devuelve lista de categorías únicas
- [ ] 2.3 Verificar respuestas contra el schema `Product` del openapi.yaml

## 3. Backend — Endpoint de ventas

- [ ] 3.1 Implementar `POST /api/sales` con validación de stock (todos los items antes de crear)
- [ ] 3.2 Asegurar transacción atómica: INSERT sale → INSERT sale_items → UPDATE stock (rollback si falla)
- [ ] 3.3 Implementar snapshot: copiar `name` y `price` del producto en el momento de la venta
- [ ] 3.4 Implementar `GET /api/sales` (historial, `?limit=20`) y `GET /api/sales/{id}` (detalle)
- [ ] 3.5 Verificar códigos de respuesta: 201 venta OK, 404 producto inexistente, 409 stock insuficiente, 422 carrito vacío

## 4. Backend — Servir frontend

- [ ] 4.1 Montar `StaticFiles` en `/` apuntando a `frontend/`

## 5. Frontend — Catálogo y ticket

- [ ] 5.1 Crear `frontend/index.html` con grid de productos y panel de ticket
- [ ] 5.2 Crear `frontend/style.css` con tema "cinta de recibo" (fondo oscuro, tipografía monoespaciada)
- [ ] 5.3 Crear `frontend/app.js`: fetch `GET /api/products`, render de tarjetas, estado del carrito en memoria
- [ ] 5.4 Al tocar un producto con stock: agregar al ticket, decrementar stock visible
- [ ] 5.5 Bloquear adición si stock local llega a 0, mostrar aviso

## 6. Frontend — Confirmar cobro

- [ ] 6.1 Botón "Cobrar" dispara `POST /api/sales` con el carrito actual
- [ ] 6.2 Respuesta 201: mostrar confirmación con folio y total, limpiar carrito
- [ ] 6.3 Respuesta 409: mostrar mensaje de error sin limpiar el carrito

## 7. Verificación manual

- [ ] 7.1 `GET /api/products` devuelve los 5 productos seed
- [ ] 7.2 Crear venta desde el frontend — verificar que el stock disminuye en DB
- [ ] 7.3 Intentar crear venta con stock insuficiente — verificar HTTP 409 y DB sin cambios
- [ ] 7.4 `GET /api/sales/{id}` devuelve snapshot correcto de precio y nombre

## 8. Tests automatizados (pytest)

- [ ] 8.1 Test: venta sin stock suficiente → 409, sin cambios en DB
- [ ] 8.2 Test: venta con producto inexistente → 404
- [ ] 8.3 Test: venta válida → 201, stock decrementado, snapshot correcto en sale_items
- [ ] 8.4 Test: GET /api/sales/{id} con id inexistente → 404

## 9. Cierre

- [ ] 9.1 Commit con mensaje conventional: `feat(pos): implementación completa POS demo`
- [ ] 9.2 Archivar el spec: `opsx:archive pos-venta`
