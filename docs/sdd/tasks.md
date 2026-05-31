# Tasks — Sistema POS Tienda Retail

## Metadata

- Basado en: design.md v1.1.0
- Versión: 1.1.0
- Fecha: 2026-05-31
- Duración estimada: 4 semanas

## Sprint 1 — Base, Auth, Branch y Auditoría (Semana 1)

> Objetivo: proyecto corriendo localmente, auth funcional, fundamentos transversales (auditoría, errores, branches).

- [ ] **T1-01**: Setup del proyecto FastAPI + estructura de carpetas
  - **Cubre:** Stack §9 (requirements)
  - **DoD:** `uvicorn app.main:app` arranca; `/health` responde 200; layout `app/{auth,products,sales,reports,core}/`.
  - **Branch:** `feat/setup`

- [ ] **T1-02**: Configurar PostgreSQL + Alembic
  - **Cubre:** Design §8 (Migraciones)
  - **DoD:** `alembic upgrade head` corre limpio sobre DB efímera en CI; convención `YYYYMMDDHHMM_*.py` documentada.
  - **Branch:** `feat/db-alembic`

- [ ] **T1-03**: Modelo `Branch` + endpoints `GET/POST/PUT /branches`
  - **Cubre:** FR-05, NFR-09, Design §3 Branch
  - **DoD:** CRUD admin de sucursales con timezone default `America/Mexico_City`; soft delete vía `is_active`.
  - **Branch:** `feat/branches`

- [ ] **T1-04**: Modelo `User` (con `branch_id`) + bcrypt factor ≥ 12
  - **Cubre:** NFR-04, Design §3 User
  - **DoD:** Migración crea User con FK a Branch; hashes verificables con `passlib`.
  - **Branch:** `feat/auth-base`

- [ ] **T1-05**: Endpoint `POST /auth/login` con JWT HS256
  - **Cubre:** FR-Auth, NFR-02, CA implícito de login
  - **DoD:** Login con credenciales válidas devuelve JWT de 8h; inválidas devuelven `AUTH_REQUIRED`.
  - **Branch:** `feat/auth-base`

- [ ] **T1-06**: Middleware de autenticación y RBAC por rol
  - **Cubre:** NFR-02, NFR-03
  - **DoD:** Decorador / dependencia `require_role(...)` aplicado a endpoints; tests verifican 401/403.
  - **Branch:** `feat/auth-base`

- [ ] **T1-07**: Modelo `AuditLog` + middleware de auditoría automática
  - **Cubre:** NFR-06, CA-04.4, Design §3 AuditLog
  - **DoD:** Toda operación CUD sobre Sale, Product, Refund emite registro en `AuditLog` con `trace_id` y `actor_id`; cubierto por test.
  - **Branch:** `feat/audit-log`

- [ ] **T1-08**: Contrato estándar de errores (handler global)
  - **Cubre:** Design §6 (códigos `AUTH_REQUIRED`..`INTERNAL_ERROR`)
  - **DoD:** Excepciones del dominio mapean a payload `{error: {code, message, request_id, details}}`; tabla de códigos cubierta por tests parametrizados.
  - **Branch:** `feat/error-contract`

- [ ] **T1-09**: Setup Redis (sesiones, idempotency keys)
  - **Cubre:** Design §1 + §5 (idempotencia)
  - **DoD:** Cliente Redis disponible vía `app.core.cache`; conexión validada en startup.
  - **Branch:** `feat/redis`

- [ ] **T1-10**: Logging estructurado JSON con `trace_id`
  - **Cubre:** NFR-07, Design §7
  - **DoD:** Cada request emite log JSON con `trace_id`, `request_id`, `actor_id`, `latency_ms`; header `X-Trace-Id` propagado.
  - **Branch:** `feat/observability`

- [ ] **T1-11**: Tests unitarios Sprint 1 (auth, branch, audit, error-handler)
  - **Cubre:** NFR-10
  - **DoD:** `pytest app/auth app/branches app/core` ≥ 70% cobertura; suite verde en CI.
  - **Branch:** `feat/tests-sprint1`

## Sprint 2 — Productos y Contrato API (Semana 2)

> Objetivo: CRUD de productos completo y revisión contract-first del OpenAPI.

- [ ] **T2-01**: OpenAPI contract-first review
  - **Cubre:** Design §4 (Endpoints), NFR-07
  - **DoD:** Spec `openapi.yaml` revisada y aprobada por backend + frontend antes de implementar endpoints; documentada divergencia si existe.
  - **Branch:** `chore/openapi-review`

- [ ] **T2-02**: Modelo `Product` + migración Alembic
  - **Cubre:** FR-02, CA-02.1, CA-02.3
  - **DoD:** Modelo con `sku` UNIQUE, `barcode` UNIQUE, validadores Pydantic para price > 0 y stock ≥ 0.
  - **Branch:** `feat/products`

- [ ] **T2-03**: `GET /products` con filtros (categoría, stock, paginación)
  - **Cubre:** FR-02
  - **DoD:** Soporta `?category=`, `?in_stock=true`, `?limit&offset`; respuesta paginada con `total`.
  - **Branch:** `feat/products`

- [ ] **T2-04**: `GET /products/search?q=` por nombre y barcode
  - **Cubre:** FR-02
  - **DoD:** Búsqueda case-insensitive sobre `name` y exact match sobre `barcode`.
  - **Branch:** `feat/products`

- [ ] **T2-05**: `POST /products` (admin)
  - **Cubre:** FR-02, CA-02.1, CA-02.3
  - **DoD:** Crea producto; conflicto de SKU/barcode devuelve `VALIDATION_ERROR`.
  - **Branch:** `feat/products`

- [ ] **T2-06**: `PUT /products/{id}` (admin)
  - **Cubre:** FR-02
  - **DoD:** Update parcial soportado; campos inmutables (id, created_at) rechazados.
  - **Branch:** `feat/products`

- [ ] **T2-07**: `DELETE /products/{id}` soft delete (admin)
  - **Cubre:** FR-02, CA-02.2
  - **DoD:** Marca `is_active=false`; producto sigue consultable desde `SaleItem` históricos.
  - **Branch:** `feat/products`

- [ ] **T2-08**: Seed script con 50 productos de prueba
  - **Cubre:** soporte de QA
  - **DoD:** `python -m app.scripts.seed_products` carga 50 productos idempotentemente.
  - **Branch:** `chore/seed-products`

- [ ] **T2-09**: Tests unitarios Sprint 2 (products + search + soft delete)
  - **Cubre:** NFR-10
  - **DoD:** `pytest app/products` ≥ 70% cobertura; casos CA-02.1, CA-02.2, CA-02.3 cubiertos.
  - **Branch:** `feat/tests-sprint2`

## Sprint 3 — Ventas, Pagos y Step Functions (Semana 3)

> Objetivo: flujo de venta completo con Step Functions e idempotencia.

- [ ] **T3-01**: Modelos `Sale` + `SaleItem` + migración (incluye `idempotency_key` UNIQUE)
  - **Cubre:** FR-01, FR-03, Design §3 + §5
  - **DoD:** Migración crea Sale con FK a User y Branch; SaleItem con CASCADE; índice UNIQUE en `idempotency_key`.
  - **Branch:** `feat/sales-models`

- [ ] **T3-02**: Endpoint `POST /sales` con header `Idempotency-Key` (orquesta Step Functions)
  - **Cubre:** FR-01, CA-01.1, CA-01.4, Design §5 (idempotencia)
  - **DoD:** Misma `Idempotency-Key` repetida devuelve la misma `Sale` sin reprocesar; latencia p95 < 2s con carrito ≤ 20 ítems.
  - **Branch:** `feat/sales-flow`

- [ ] **T3-03**: Step `CheckIdempotency` (Redis + Sale.idempotency_key)
  - **Cubre:** Design §5
  - **DoD:** Hit en Redis devuelve respuesta cacheada; miss continúa al siguiente paso.
  - **Branch:** `feat/sales-flow`

- [ ] **T3-04**: Step `ValidateCart` — verifica stock
  - **Cubre:** CA-01.2
  - **DoD:** Si algún SKU tiene stock insuficiente devuelve 409 `STOCK_INSUFFICIENT` y NO descuenta inventario.
  - **Branch:** `feat/sales-flow`

- [ ] **T3-05**: Step `CalculateTotals` — subtotal + IVA 16% banker's rounding
  - **Cubre:** CA-01.3
  - **DoD:** Total = subtotal + tax; redondeo a 2 decimales `ROUND_HALF_EVEN`; suite de casos límite cubierta.
  - **Branch:** `feat/sales-flow`

- [ ] **T3-06**: Step `ProcessPayment` efectivo (cálculo de cambio)
  - **Cubre:** FR-03, CA-03.1
  - **DoD:** `cash_received >= total` requerido; `change_given = cash_received - total`.
  - **Branch:** `feat/sales-flow`

- [ ] **T3-07**: Step `ProcessPayment` tarjeta (mock terminal)
  - **Cubre:** FR-03, CA-03.2
  - **DoD:** Mock devuelve `approved`/`declined`; en `declined` Sale queda `cancelled`, código `PAYMENT_DECLINED`, sin descontar inventario.
  - **Branch:** `feat/sales-flow`

- [ ] **T3-08**: Step `UpdateInventory` — descuenta stock atómicamente
  - **Cubre:** CA-01.1
  - **DoD:** Update con `SELECT ... FOR UPDATE` por SKU; falla → compensación + alerta.
  - **Branch:** `feat/sales-flow`

- [ ] **T3-09**: Step `PersistSale` (commit Sale + SaleItem)
  - **Cubre:** FR-01
  - **DoD:** Transacción atómica; rollback si cualquier item falla.
  - **Branch:** `feat/sales-flow`

- [ ] **T3-10**: Step `GenerateTicket` — texto plano + PDF
  - **Cubre:** FR-01
  - **DoD:** Ticket texto descargable vía `GET /sales/{id}/ticket?format=txt|pdf`.
  - **Branch:** `feat/sales-flow`

- [ ] **T3-11**: Step `EmitAuditLog` — escribe AuditLog + CloudWatch
  - **Cubre:** NFR-06, NFR-07
  - **DoD:** Cada venta `completed` genera registro `AuditLog` con `action=create`, `entity_type=Sale`.
  - **Branch:** `feat/sales-flow`

- [ ] **T3-12**: `GET /sales/{id}` con detalle y ticket
  - **Cubre:** FR-01
  - **DoD:** Devuelve sale + items + payment + link al ticket.
  - **Branch:** `feat/sales-flow`

- [ ] **T3-13**: Tests unitarios + de integración Sprint 3 (flujo venta end-to-end)
  - **Cubre:** NFR-10
  - **DoD:** `pytest app/sales` ≥ 70% cobertura; test e2e cubre happy path + stock insuficiente + tarjeta declined + idempotencia.
  - **Branch:** `feat/tests-sprint3`

## Sprint 4 — Devoluciones, Reportes, Rate Limiting y Deploy (Semana 4)

> Objetivo: sistema completo desplegado en AWS con rate limiting y observabilidad.

- [ ] **T4-01**: Modelo `RefundLog` + migración
  - **Cubre:** FR-04, Design §3
  - **DoD:** FK a Sale y User; migración aplicada.
  - **Branch:** `feat/refunds`

- [ ] **T4-02**: Modelo `CreditNote` (1:1 con RefundLog) + migración
  - **Cubre:** CA-04.4, Design §3 CreditNote
  - **DoD:** FK UNIQUE a `refund_log_id`; total y reason persistidos.
  - **Branch:** `feat/refunds`

- [ ] **T4-03**: `POST /sales/{id}/refund` (supervisor+) emite RefundLog + CreditNote
  - **Cubre:** FR-04, CA-04.1, CA-04.2, CA-04.4
  - **DoD:** Solo supervisor/admin; soporta refund total y parcial por SaleItem; emite exactamente una CreditNote por refund.
  - **Branch:** `feat/refunds`

- [ ] **T4-04**: Reversión de inventario en devoluciones
  - **Cubre:** CA-04.3
  - **DoD:** Stock se incrementa exactamente en la cantidad devuelta; registrado en AuditLog `action=refund`.
  - **Branch:** `feat/refunds`

- [ ] **T4-05**: `GET /reports/daily` — corte del día (TZ America/Mexico_City)
  - **Cubre:** FR-05, CA-05.1
  - **DoD:** Suma ventas `completed` en `[00:00, 23:59:59]` TZ MX; soporta `?date=YYYY-MM-DD`.
  - **Branch:** `feat/reports`

- [ ] **T4-06**: `GET /reports/top-products` — más vendidos
  - **Cubre:** FR-05
  - **DoD:** Ordena por unidades vendidas en rango `?from=&to=`; default últimos 30 días.
  - **Branch:** `feat/reports`

- [ ] **T4-07**: `GET /reports/cashier/{id}` — corte por cajero
  - **Cubre:** FR-05, CA-05.2
  - **DoD:** Devuelve total por método de pago, número de tickets, devoluciones del turno.
  - **Branch:** `feat/reports`

- [ ] **T4-08**: `GET /audit-logs` (admin) — listado paginado
  - **Cubre:** NFR-06
  - **DoD:** Filtros por `entity_type`, `actor_id`, rango de fechas; paginación cursor.
  - **Branch:** `feat/audit-log`

- [ ] **T4-09**: Rate limiting en API Gateway (100 req/min por IP)
  - **Cubre:** NFR-05, Design §6 (`RATE_LIMITED`)
  - **DoD:** Configuración Terraform/SAM aplicada; exceder el límite devuelve 429 `RATE_LIMITED`. Implementación naïve (sin sliding window Redis, ver DT-05).
  - **Branch:** `feat/rate-limit`

- [ ] **T4-10**: Métricas CloudWatch (`sales_per_minute`, `payment_decline_rate`, `p95_response_time`)
  - **Cubre:** NFR-07, Design §7
  - **DoD:** Dashboard CloudWatch publicado; alarma sobre `p95_response_time(/sales) > 2s`.
  - **Branch:** `feat/observability`

- [ ] **T4-11**: Deploy FastAPI a AWS Lambda con Mangum
  - **Cubre:** D-01, Stack §9
  - **DoD:** `sam deploy` exitoso a entorno `staging`; `/health` responde a través de API Gateway.
  - **Branch:** `feat/deploy`

- [ ] **T4-12**: Configurar API Gateway + rutas + custom domain
  - **Cubre:** Design §1
  - **DoD:** Todas las rutas del design §4 expuestas; rate limiting activo.
  - **Branch:** `feat/deploy`

- [ ] **T4-13**: Variables de entorno en AWS Secrets Manager
  - **Cubre:** NFR-04
  - **DoD:** JWT secret, DB credentials, Redis URL en Secrets Manager; Lambda con permisos `secretsmanager:GetSecretValue`.
  - **Branch:** `feat/deploy`

- [ ] **T4-14**: Tests unitarios Sprint 4 (refunds + reports + audit endpoint)
  - **Cubre:** NFR-10
  - **DoD:** `pytest app/refunds app/reports` ≥ 70% cobertura.
  - **Branch:** `feat/tests-sprint4`

- [ ] **T4-15**: Tests de integración end-to-end
  - **Cubre:** NFR-10
  - **DoD:** Suite e2e cubre: login → producto → venta → refund → reporte → audit log; corre en CI.
  - **Branch:** `feat/tests-e2e`

- [ ] **T4-16**: Revisar documentación OpenAPI auto-generada (Swagger)
  - **Cubre:** Design §4
  - **DoD:** `/docs` accesible; spec coincide con `openapi.yaml` revisado en T2-01.
  - **Branch:** `chore/openapi-final`

- [ ] **T4-17**: Definition of Done global del MVP (shippable)
  - **Cubre:** todos los FR/NFR
  - **DoD:** Checklist firmado:
    - Todos los FR-01..FR-05 cumplidos con sus CA verdes.
    - Cobertura ≥ 70% en `app/sales`, `app/products`, `app/auth`.
    - p95 `/sales` < 2s en staging.
    - Alarmas CloudWatch configuradas.
    - Spec OpenAPI publicada.
    - Migraciones forward-only aplicadas a staging.
    - `tech-debt.md` actualizado con cualquier deuda nueva.
    - Runbook básico de operación (login admin, restablecer password, ejecutar refund) documentado.
  - **Branch:** `chore/dod-mvp`

## GitHub Flow sugerido

```text
main
 └── develop
      ├── feat/setup, feat/db-alembic, feat/auth-base, feat/branches,
      │   feat/audit-log, feat/error-contract, feat/redis,
      │   feat/observability, feat/tests-sprint1            (Sprint 1)
      ├── chore/openapi-review, feat/products,
      │   chore/seed-products, feat/tests-sprint2           (Sprint 2)
      ├── feat/sales-models, feat/sales-flow,
      │   feat/tests-sprint3                                 (Sprint 3)
      └── feat/refunds, feat/reports, feat/rate-limit,
          feat/deploy, feat/tests-sprint4, feat/tests-e2e,
          chore/openapi-final, chore/dod-mvp                 (Sprint 4)
```

## Convención de commits

```text
feat(auth): add JWT login endpoint
fix(products): correct soft delete query
docs(sdd): update design.md with RefundLog model
chore(deps): add mangum for Lambda deploy
```

## Changelog

| Versión | Fecha | Descripción |
| --- | --- | --- |
| 1.0.0 | 2026-05-31 | Versión inicial |
| 1.1.0 | 2026-05-31 | Renumeración T{sprint}-NN; cada tarea con `Cubre/DoD/Branch`; tests distribuidos por sprint; agregadas tareas Branch (T1-03), AuditLog + middleware (T1-07), contrato de errores (T1-08), OpenAPI review (T2-01), CreditNote (T4-02), rate limiting (T4-09), Definition of Done MVP (T4-17). |
