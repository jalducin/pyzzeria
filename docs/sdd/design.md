# Design — Sistema POS Tienda Retail

## Metadata
- Basado en: requirements.md v1.0.0
- Versión: 1.0.0
- Fecha: 2026-05-31
- Estado: Pendiente de aprobación

## 1. Arquitectura General

```
[Frontend / Terminal POS]
        |
   [API Gateway]
        |
   [FastAPI App — Lambda]
        |
   ┌────┴────────────────┐
[PostgreSQL]          [Redis Cache]
        |
[Step Functions — Flujo de Venta]
```

## 2. Modelos de Datos

### User
```sql
id          UUID PRIMARY KEY
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
id              UUID PRIMARY KEY
cashier_id      UUID FK → User
subtotal        DECIMAL(10,2)
tax             DECIMAL(10,2)
total           DECIMAL(10,2)
payment_method  ENUM(cash, card, transfer, qr)
cash_received   DECIMAL(10,2)
change_given    DECIMAL(10,2)
status          ENUM(completed, cancelled, refunded)
created_at      TIMESTAMP DEFAULT NOW()
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

## 3. Endpoints API

### Auth
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | /auth/login | público | Login → JWT |
| POST | /auth/logout | cualquiera | Invalida token |

### Products
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | /products | cajero+ | Lista con filtros |
| GET | /products/{id} | cajero+ | Detalle |
| GET | /products/search?q= | cajero+ | Por nombre o barcode |
| POST | /products | admin | Crear producto |
| PUT | /products/{id} | admin | Editar producto |
| DELETE | /products/{id} | admin | Soft delete |

### Sales
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | /sales | cajero+ | Nueva venta |
| GET | /sales/{id} | cajero+ | Detalle + ticket |
| GET | /sales | supervisor+ | Historial filtrado |
| POST | /sales/{id}/refund | supervisor+ | Devolución |

### Reports
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | /reports/daily | supervisor+ | Corte del día |
| GET | /reports/top-products | supervisor+ | Más vendidos |
| GET | /reports/cashier/{id} | supervisor+ | Corte por cajero |

## 4. Flujo de Venta — Step Functions

```
START
  → ValidateCart         (verifica stock disponible)
  → CalculateTotals      (subtotal + IVA 16%)
  → ProcessPayment       (mock terminal / efectivo)
  → UpdateInventory      (descuenta stock en PostgreSQL)
  → GenerateTicket       (PDF o texto plano)
  → SaveAuditLog         (CloudWatch)
END
```

### Manejo de errores
- ValidateCart falla → 409 stock insuficiente
- ProcessPayment falla → rollback, estado cancelled
- UpdateInventory falla → compensación manual + alerta

## 5. Seguridad
- Todos los endpoints requieren JWT excepto POST /auth/login
- RBAC: cajero → ventas; supervisor → refunds + reportes; admin → todo
- Tokens expiran en 8 horas
- Rate limiting: 100 req/min por IP en API Gateway
- Passwords con bcrypt factor 12

## Changelog
| Versión | Fecha | Descripción |
|---|---|---|
| 1.0.0 | 2026-05-31 | Versión inicial |
