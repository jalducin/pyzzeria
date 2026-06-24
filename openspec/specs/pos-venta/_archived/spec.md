## User Story

**Como** cajero de un negocio pequeño,
**quiero** seleccionar productos de un catálogo, ver el ticket en tiempo real y cobrar,
**para** registrar ventas rápido sin que se desincronice el inventario.

---

## ADDED Requirements

### Requirement: Catálogo de productos

El sistema expone un catálogo de productos con nombre, precio, stock y categoría.

#### Scenario: Listar productos
- **WHEN** el cajero abre el POS
- **THEN** ve todos los productos con su stock actual, agrupables por categoría

#### Scenario: Filtrar por categoría
- **WHEN** el cajero selecciona una categoría
- **THEN** solo se muestran los productos de esa categoría

---

### Requirement: Armar ticket

El cajero puede agregar productos a un ticket antes de confirmar el cobro.

#### Scenario: Agregar producto con stock
- **WHEN** el cajero toca un producto con stock disponible
- **THEN** el producto se agrega al ticket y el stock visible en pantalla disminuye en 1

#### Scenario: Bloqueo por stock insuficiente
- **WHEN** el cajero intenta agregar un producto cuyo stock ya está agotado en el carrito
- **THEN** el sistema bloquea la acción y muestra un aviso de sin stock

---

### Requirement: Confirmar venta

Al confirmar el cobro el sistema valida el stock en el servidor y registra la venta atómicamente.

#### Scenario: Venta exitosa
- **WHEN** el cajero confirma el cobro con un carrito válido (todos los items con stock suficiente)
- **THEN** se crea la venta en la base de datos, se descuenta el stock de cada producto, y el cajero ve el folio y el total

#### Scenario: Stock insuficiente en servidor
- **WHEN** el cajero confirma el cobro pero en el servidor ya no hay stock suficiente para algún item
- **THEN** el sistema responde HTTP 409, no se crea la venta, y el inventario no cambia

#### Scenario: Carrito vacío
- **WHEN** el cajero intenta confirmar un cobro sin items
- **THEN** el sistema responde HTTP 422 y no crea la venta

#### Scenario: Concurrencia — dos cajeros, último producto
- **WHEN** dos cajeros intentan vender el último producto en stock casi al mismo tiempo
- **THEN** solo uno logra completar la venta (validación y descuento ocurren en el servidor dentro de una transacción atómica); el otro recibe HTTP 409

---

### Requirement: Historial de ventas

El sistema guarda un historial de ventas consultable.

#### Scenario: Ver historial reciente
- **WHEN** se consulta GET /api/sales
- **THEN** se devuelve la lista de ventas recientes (últimas 20 por defecto) con folio, total y fecha

#### Scenario: Ver detalle de venta
- **WHEN** se consulta GET /api/sales/{id} con un id existente
- **THEN** se devuelve la venta con todos sus items (snapshot de nombre y precio al momento de la venta)

#### Scenario: Venta no encontrada
- **WHEN** se consulta GET /api/sales/{id} con un id inexistente
- **THEN** el sistema responde HTTP 404

---

### Requirement: Snapshot de precio y nombre

Los items de venta conservan el precio y nombre del producto en el momento de la venta.

#### Scenario: Cambio de precio futuro no altera historial
- **WHEN** el precio de un producto cambia después de una venta ya registrada
- **THEN** el historial sigue mostrando el precio que tenía al momento de la venta
