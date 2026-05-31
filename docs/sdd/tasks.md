# Tasks — Sistema POS Tienda Retail

## Metadata
- Basado en: design.md v1.0.0
- Versión: 1.0.0
- Fecha: 2026-05-31
- Duración estimada: 4 semanas

## Sprint 1 — Base y Auth (Semana 1)
> Objetivo: proyecto corriendo localmente con auth funcional

- [ ] T-01: Setup del proyecto FastAPI + estructura de carpetas
- [ ] T-02: Configurar PostgreSQL + migraciones con Alembic
- [ ] T-03: Modelo User + hash de contraseñas con bcrypt
- [ ] T-04: Endpoint POST /auth/login con JWT
- [ ] T-05: Middleware de autenticación y RBAC por rol
- [ ] T-06: Setup Redis para caché de sesiones
- [ ] T-07: Configurar logging centralizado (CloudWatch ready)

**Branch sugerido:** `feat/auth-base`

## Sprint 2 — Productos (Semana 2)
> Objetivo: CRUD de productos completo y testeado

- [ ] T-08: Modelo Product + migración Alembic
- [ ] T-09: GET /products con filtros de categoría y stock
- [ ] T-10: GET /products/search?q= por nombre y barcode
- [ ] T-11: POST /products (admin)
- [ ] T-12: PUT /products/{id} (admin)
- [ ] T-13: DELETE /products/{id} soft delete (admin)
- [ ] T-14: Tests unitarios endpoints productos (pytest)
- [ ] T-15: Seed script con 50 productos de prueba

**Branch sugerido:** `feat/products`

## Sprint 3 — Ventas y Pagos (Semana 3)
> Objetivo: flujo de venta completo con Step Functions

- [ ] T-16: Modelos Sale + SaleItem + migraciones
- [ ] T-17: Endpoint POST /sales (orquesta Step Functions)
- [ ] T-18: Step: ValidateCart — verifica stock
- [ ] T-19: Step: CalculateTotals — subtotal + IVA 16%
- [ ] T-20: Step: ProcessPayment efectivo (cálculo de cambio)
- [ ] T-21: Step: ProcessPayment tarjeta (mock terminal)
- [ ] T-22: Step: UpdateInventory — descuenta stock
- [ ] T-23: Step: GenerateTicket — texto plano + PDF
- [ ] T-24: Step: SaveAuditLog → CloudWatch
- [ ] T-25: GET /sales/{id} con detalle y ticket

**Branch sugerido:** `feat/sales-flow`

## Sprint 4 — Devoluciones, Reportes y Deploy (Semana 4)
> Objetivo: sistema completo desplegado en AWS

- [ ] T-26: Modelo RefundLog + migración
- [ ] T-27: POST /sales/{id}/refund (supervisor)
- [ ] T-28: Reversión de inventario en devoluciones
- [ ] T-29: GET /reports/daily — corte del día
- [ ] T-30: GET /reports/top-products — más vendidos
- [ ] T-31: GET /reports/cashier/{id} — corte por cajero
- [ ] T-32: Deploy FastAPI a AWS Lambda con Mangum
- [ ] T-33: Configurar API Gateway + rutas
- [ ] T-34: Variables de entorno en AWS Secrets Manager
- [ ] T-35: Tests de integración end-to-end
- [ ] T-36: Revisar documentación OpenAPI auto-generada (Swagger)

**Branch sugerido:** `feat/reports-deploy`

## GitHub Flow sugerido
```
main
 └── develop
      ├── feat/auth-base      (Sprint 1)
      ├── feat/products       (Sprint 2)
      ├── feat/sales-flow     (Sprint 3)
      └── feat/reports-deploy (Sprint 4)
```

## Convención de commits
```
feat(auth): add JWT login endpoint
fix(products): correct soft delete query
docs(sdd): update design.md with RefundLog model
chore(deps): add mangum for Lambda deploy
```

## Changelog
| Versión | Fecha | Descripción |
|---|---|---|
| 1.0.0 | 2026-05-31 | Versión inicial |
