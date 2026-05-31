# Design — Sistema POS Tienda Retail

## Metadata

- Basado en: requirements.md v1.1.0
- Versión: 1.1.1
- Fecha: 2026-05-31
- Estado: Pendiente de aprobación

## 1. Arquitectura General

```text
[Frontend / Terminal POS]
        |
   [API Gateway]
        |
   [FastAPI App — Lambda + Mangum]
        |
   ┌────┴────────────────┐
[PostgreSQL]          [Redis Cache]
        |
[Step Functions — Flujo de Venta]
        |
[CloudWatch — Logs + Métricas]
```

Componentes principales:

- **API Gateway**: terminación TLS, rate limiting, ruteo a Lambda.
- **FastAPI App (Lambda)**: handlers HTTP, validación Pydantic, RBAC, emisión de eventos a Step Functions.
- **Step Functions**: orquesta el flujo transaccional de venta (validación → pago → inventario → ticket → auditoría).
- **PostgreSQL**: store transaccional (User, Branch, Product, Sale, SaleItem, RefundLog, CreditNote, AuditLog).
- **Redis**: caché de sesiones, idempotency keys, contadores de rate limiting auxiliares.
- **CloudWatch**: logs estructurados JSON, métricas custom, alarmas.

## 2. Matriz de Trazabilidad

Mapea cada FR/NFR/UC al componente y endpoint que lo implementa.

| ID | Tipo | Componente | Endpoint(s) | Modelos |
| --- | --- | --- | --- | --- |
| FR-01 / UC-01 | Funcional | Sales + Step Functions | `POST /sales`, `GET /sales/{id}` | Sale, SaleItem, Product |
| FR-02 / UC-02 | Funcional | Products | `GET/POST/PUT/DELETE /products`, `GET /products/search` | Product |
| FR-03 / UC-03 | Funcional | Sales (ProcessPayment) | `POST /sales` (payment_method) | Sale |
| FR-04 / UC-04 | Funcional | Refunds | `POST /sales/{id}/refund` | RefundLog, CreditNote, Sale |
| FR-05 / UC-05 | Funcional | Reports | `GET /reports/daily`, `/reports/top-products`, `/reports/cashier/{id}` | Sale, SaleItem |
| NFR-01 | Rendimiento | Sales + Step Functions | `POST /sales` (p95 < 2s) | — |
| NFR-02 | Seguridad | Auth middleware | Todos excepto `POST /auth/login` | User |
| NFR-03 | Seguridad | RBAC middleware | Todos | User.role |
| NFR-04 | Seguridad | Auth | `POST /auth/login` | User.password |
| NFR-05 | Seguridad | API Gateway | Todos | — |
| NFR-06 | Auditoría | Audit middleware | Hooks en Sales, Products, Refunds | AuditLog |
| NFR-07 | Observabilidad | Logging middleware | Todos | — |
| NFR-08 | Disponibilidad | AWS Lambda + RDS Multi-AZ | — | — |
| NFR-09 | Localización | Sales / Reports | `POST /sales`, `GET /reports/*` | Sale (zona TZ MX) |
| NFR-10 | Calidad | Tests pytest | — | — |
| CA-04.4 | Devoluciones | Refunds + Audit | `POST /sales/{id}/refund` | CreditNote, AuditLog |

## 3. Modelos de Datos

### Branch

```sql
id          UUID PRIMARY KEY
name        VARCHAR(200) NOT NULL
address     VARCHAR(500)
timezone    VARCHAR(50)  DEFAULT 'America/Mexico_City'
is_active   BOOLEAN      DEFAULT TRUE
created_at  TIMESTAMP    DEFAULT NOW()
```

Soporta multi-sucursal (FR-05 / NFR-09).

### User

```sql
id          UUID PRIMARY KEY
branch_id   UUID FK → Branch
name        VARCHAR(200)
email       VARCHAR(200) UNIQUE NOT NULL
password    VARCHAR(255)
role        ENUM(cashier, supervisor, admin)
is_active   BOOLEAN DEFAULT TRUE
created_at  TIMESTAMP DEFAULT NOW()
```

### Product

```sql
id          UUID PRIMARY KEY
sku         VARCHAR(50)  UNIQUE NOT NULL
name        VARCHAR(200) NOT NULL
price       DECIMAL(10,2) NOT NULL
stock       INTEGER DEFAULT 0
category    VARCHAR(100)
barcode     VARCHAR(100) UNIQUE
is_active   BOOLEAN DEFAULT TRUE
created_at  TIMESTAMP DEFAULT NOW()
updated_at  TIMESTAMP
```

### Sale

```sql
id               UUID PRIMARY KEY
cashier_id       UUID FK → User
branch_id        UUID FK → Branch
subtotal         DECIMAL(10,2)
tax              DECIMAL(10,2)
total            DECIMAL(10,2)
payment_method   ENUM(cash, card, transfer, qr)
cash_received    DECIMAL(10,2)
change_given     DECIMAL(10,2)
status           ENUM(completed, cancelled, refunded)
idempotency_key  VARCHAR(64) UNIQUE
created_at       TIMESTAMP DEFAULT NOW()
```

### SaleItem

```sql
id          UUID PRIMARY KEY
sale_id     UUID FK → Sale ON DELETE CASCADE
product_id  UUID FK → Product
quantity    INTEGER NOT NULL
unit_price  DECIMAL(10,2) NOT NULL
subtotal    DECIMAL(10,2) NOT NULL
```

### RefundLog

```sql
id              UUID PRIMARY KEY
original_sale   UUID FK → Sale
supervisor_id   UUID FK → User
reason          TEXT
created_at      TIMESTAMP DEFAULT NOW()
```

`RefundLog` mantiene una relación **1:1** con `CreditNote`: por cada `RefundLog` se emite exactamente una `CreditNote`. `RefundLog` registra el acto operativo (quién autorizó, motivo); `CreditNote` registra el documento financiero (monto devuelto, evidencia para la integrante).

### CreditNote

```sql
id              UUID PRIMARY KEY
sale_id         UUID FK → Sale
refund_log_id   UUID FK → RefundLog UNIQUE
supervisor_id   UUID FK → User
total           DECIMAL(10,2) NOT NULL
reason          TEXT
created_at      TIMESTAMP DEFAULT NOW()
```

Cubre CA-04.4.

### AuditLog

```sql
id           UUID PRIMARY KEY
actor_id     UUID FK → User
entity_type  VARCHAR(50)   NOT NULL
entity_id    UUID          NOT NULL
action       ENUM(create, update, delete, refund)
payload      JSONB
trace_id     VARCHAR(64)
created_at   TIMESTAMP     DEFAULT NOW()
```

Cubre NFR-06. Se escribe desde un middleware de auditoría y desde el paso `EmitAuditLog` del flujo de venta. Valores típicos de `entity_type`: `Sale`, `Product`, `Refund`, `User`, `Branch`.

## 4. Endpoints API

### Auth

| Método | Ruta | Rol | Cubre | Descripción |
| --- | --- | --- | --- | --- |
| POST | /auth/login | público | NFR-02, NFR-04 | Login → JWT |
| POST | /auth/logout | cualquiera | NFR-02 | Invalida token |

### Branches

| Método | Ruta | Rol | Cubre | Descripción |
| --- | --- | --- | --- | --- |
| GET | /branches | admin | FR-05, NFR-09 | Lista sucursales |
| POST | /branches | admin | FR-05 | Crear sucursal |
| PUT | /branches/{id} | admin | FR-05 | Editar sucursal |

### Products

| Método | Ruta | Rol | Cubre | Descripción |
| --- | --- | --- | --- | --- |
| GET | /products | cajero+ | FR-02 | Lista con filtros |
| GET | /products/{id} | cajero+ | FR-02 | Detalle |
| GET | /products/search?q= | cajero+ | FR-02 | Por nombre o barcode |
| POST | /products | admin | FR-02, CA-02.1, CA-02.3 | Crear producto |
| PUT | /products/{id} | admin | FR-02 | Editar producto |
| DELETE | /products/{id} | admin | FR-02, CA-02.2 | Soft delete |

### Sales

| Método | Ruta | Rol | Cubre | Descripción |
| --- | --- | --- | --- | --- |
| POST | /sales | cajero+ | FR-01, FR-03, CA-01.1, CA-01.2, CA-01.4 | Nueva venta (idempotente) |
| GET | /sales/{id} | cajero+ | FR-01 | Detalle + ticket |
| GET | /sales | supervisor+ | FR-04 | Historial filtrado |
| POST | /sales/{id}/refund | supervisor+ | FR-04, CA-04.1, CA-04.2, CA-04.3, CA-04.4 | Devolución + emisión de nota de crédito |

### Reports

| Método | Ruta | Rol | Cubre | Descripción |
| --- | --- | --- | --- | --- |
| GET | /reports/daily | supervisor+ | FR-05, CA-05.1 | Corte del día |
| GET | /reports/top-products | supervisor+ | FR-05 | Más vendidos |
| GET | /reports/cashier/{id} | supervisor+ | FR-05, CA-05.2 | Corte por cajero |

### Audit

| Método | Ruta | Rol | Cubre | Descripción |
| --- | --- | --- | --- | --- |
| GET | /audit-logs | admin | NFR-06 | Listado paginado de eventos auditables |

## 5. Flujo de Venta — Step Functions

```text
START
  → CheckIdempotency      (consulta idempotency_key en Redis / Sale)
  → ValidateCart          (verifica stock disponible)
  → CalculateTotals       (subtotal + IVA 16%)
  → ProcessPayment        (mock terminal / efectivo)
  → UpdateInventory       (descuenta stock en PostgreSQL)
  → PersistSale           (commit transaccional Sale + SaleItem)
  → GenerateTicket        (PDF o texto plano)
  → EmitAuditLog          (escribe AuditLog y publica a CloudWatch)
END
```

### Idempotencia

- `POST /sales` acepta header `Idempotency-Key` (UUID o token de 32+ chars).
- Si la clave ya existe asociada a una `Sale` previa, se devuelve el resultado original sin reprocesar.
- TTL de la clave en Redis: 24h. Persistencia adicional en `Sale.idempotency_key` (UNIQUE) como respaldo.

### Manejo de errores

- `CheckIdempotency` hit → devuelve respuesta cacheada.
- `ValidateCart` falla → 409 `STOCK_INSUFFICIENT`.
- `ProcessPayment` falla → rollback, `Sale.status = cancelled`, código `PAYMENT_DECLINED`.
- `UpdateInventory` falla → compensación manual + alerta CloudWatch; estado `Sale.status` queda `cancelled`.
- `EmitAuditLog` falla → no bloquea la venta; se reintenta con DLQ.

## 6. Seguridad

### Autenticación y autorización

- Todos los endpoints requieren JWT (HS256) excepto `POST /auth/login`.
- RBAC: cajero → ventas; supervisor → refunds + reportes; admin → todo + branches + audit-logs.
- Tokens expiran en 8 horas. Sin refresh token en v1.0 (ver DT-03).
- Rate limiting: 100 req/min por IP en API Gateway (NFR-05). Implementación inicial naïve a nivel API Gateway (ver DT-05).
- Passwords con bcrypt factor ≥ 12.

### Contrato estándar de errores

Todas las respuestas de error devuelven JSON con la siguiente forma:

```json
{
  "error": {
    "code": "STOCK_INSUFFICIENT",
    "message": "El producto SKU-001 no tiene stock suficiente.",
    "request_id": "req_01J0...",
    "details": {
      "sku": "SKU-001",
      "available": 2,
      "requested": 5
    }
  }
}
```

| Código | HTTP | Cuándo se emite |
| --- | --- | --- |
| AUTH_REQUIRED | 401 | Sin JWT o token expirado |
| FORBIDDEN | 403 | JWT válido pero el rol no autoriza la operación |
| NOT_FOUND | 404 | Recurso inexistente |
| VALIDATION_ERROR | 422 | Payload no cumple schema Pydantic |
| STOCK_INSUFFICIENT | 409 | Cart con SKU sin stock (CA-01.2) |
| PAYMENT_DECLINED | 402 | Mock de terminal devuelve `declined` (CA-03.2) |
| RATE_LIMITED | 429 | Excede 100 req/min (NFR-05) |
| INTERNAL_ERROR | 500 | Excepción no controlada |

## 7. Observabilidad

Cubre NFR-07.

- **Logging estructurado JSON** en stdout (capturado por CloudWatch Logs). Cada línea incluye: `timestamp`, `level`, `trace_id`, `request_id`, `actor_id`, `route`, `latency_ms`, `status_code`, `message`.
- **trace_id** se propaga por header `X-Trace-Id` o se genera al ingreso de la request.
- **Métricas custom** exportadas a CloudWatch:
  - `sales_per_minute` — conteo de ventas en estado `completed`.
  - `payment_decline_rate` — ratio de pagos `declined` sobre intentos.
  - `p95_response_time` por endpoint (gate de NFR-01).
  - `refund_count_per_day`.
- **Alarmas CloudWatch**: `p95_response_time(/sales) > 2s` por 5 min; `payment_decline_rate > 10%` por 10 min.

## 8. Estrategia de Migraciones

- Herramienta: **Alembic** (autogeneración + revisión manual).
- Convención de archivos: `YYYYMMDDHHMM_descripcion.py` (ej. `202606011030_add_branch_table.py`).
- Reglas:
  - Cada PR que toque modelos incluye su migración en el mismo commit.
  - Migraciones son **forward-only** en producción; rollback se hace por nueva migración compensatoria.
  - Se valida en CI: `alembic upgrade head` sobre DB efímera antes de merge.
  - Datos de seed van en scripts separados, no dentro de migraciones de schema.

### Entornos de base de datos

| Entorno | Motor | Conexión |
| --- | --- | --- |
| Dev local | SQLite (`pos_local.db`) | `sqlite:///./pos_local.db` (default si no hay `DATABASE_URL`) |
| Tests automatizados | SQLite in-memory (StaticPool) | `sqlite:///:memory:` con esquema cargado desde `Base.metadata` |
| Staging / Producción | PostgreSQL gestionado | `postgresql+psycopg://...` desde Secrets Manager |

Los modelos usan tipos dialect-agnostic de SQLAlchemy 2.0 (`Uuid`, `JSON`) para ser portables. SQLite tiene limitaciones documentadas (sin `JSONB`, sin `SELECT ... FOR UPDATE`, locking distinto) — ver DT-11 para el plan de validar contra Postgres efímero en CI antes de release.

## 9. Decisiones Arquitectónicas (ADR ligero)

| ID | Decisión | Alternativa descartada | Motivo | Referencia |
| --- | --- | --- | --- | --- |
| D-01 | FastAPI sobre AWS Lambda con Mangum | ECS Fargate / EC2 con uvicorn | Cold-start tolerable (< 1s) para tráfico de tienda; menor costo operativo; cero servidores que mantener. | NFR-01, NFR-08 |
| D-02 | Step Functions para el flujo de venta | Lógica monolítica dentro de un endpoint | Permite reintentos por paso, observabilidad granular del flujo, compensaciones explícitas y desacople de `ProcessPayment`. | FR-01, NFR-07 |
| D-03 | JWT sin refresh token | JWT con refresh + revocación en Redis | Simplifica v1.0; turno típico ≤ 8h. Se asume re-login al cierre. | DT-03 |
| D-04 | Modo offline diferido a v2.0 | Cola local + reconciliación al reconectar | Excede alcance de 4 sprints; supuesto de red estable. | DT-01 |
| D-05 | Rate limiting en API Gateway (sin sliding window Redis) | Sliding window por usuario en Redis | Implementación naïve suficiente para piloto; el upgrade queda registrado como deuda. | DT-05 |

## Changelog

| Versión | Fecha | Descripción |
| --- | --- | --- |
| 1.0.0 | 2026-05-31 | Versión inicial |
| 1.1.0 | 2026-05-31 | Matriz de trazabilidad (§2); entidades Branch, AuditLog, CreditNote; User.branch_id; endpoints /branches y /audit-logs; idempotencia en POST /sales; contrato estándar de errores (§6); §7 Observabilidad; §8 Migraciones; §9 Decisiones (D-01..D-05). |
| 1.1.1 | 2026-05-31 | §8: agregada tabla de entornos de base de datos (SQLite dev/test, Postgres staging/prod) + referencia a DT-11. Modelos refactorizados a tipos dialect-agnostic. |
