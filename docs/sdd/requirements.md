# Requirements — Sistema POS Tienda Retail

## Metadata
- Proyecto: POS Retail (práctica)
- Versión: 1.1.0
- Fecha: 2026-05-31
- Metodología: Spec-Driven Development (SDD)

## 1. Descripción General
Sistema de punto de venta para tienda retail con soporte multi-cajero, multi-sucursal, gestión de inventario básico, métodos de pago múltiples y reportes de ventas.

## 2. Actores
| Actor | Descripción |
|---|---|
| **Cajero** | Opera el POS, procesa ventas y pagos |
| **Supervisor** | Accede a reportes, autoriza devoluciones |
| **Admin** | Configura productos, usuarios, sucursales y catálogos |

## 3. Glosario
| Término | Definición |
|---|---|
| **SKU** | Stock Keeping Unit. Identificador interno único de producto |
| **IVA** | Impuesto al Valor Agregado, 16% en México (régimen general) |
| **Corte de caja** | Cierre operativo por cajero/turno: total vendido, efectivo en caja, diferencias |
| **Ticket** | Comprobante simplificado de venta entregado a la integrante; no es CFDI |
| **Nota de crédito** | Documento que respalda una devolución total o parcial |
| **Multi-cajero** | Varios cajeros pueden operar en paralelo en la misma sucursal |
| **Sucursal (Branch)** | Punto físico donde opera uno o más cajeros |

## 4. Casos de Uso y Requerimientos Funcionales

### UC-01 / FR-01: Procesar Venta
- Cajero escanea productos (código de barras o búsqueda manual)
- Sistema calcula subtotal, IVA (16%) y total
- Cajero selecciona método de pago
- Sistema genera ticket (texto plano y PDF descargable)
- Inventario se descuenta automáticamente al confirmar pago

**Criterios de aceptación:**
- CA-01.1: Dado un carrito con N productos válidos en stock, cuando el cajero confirma el pago, entonces se persiste la venta en estado `completed` y el stock disminuye exactamente en la cantidad vendida por SKU.
- CA-01.2: Dado un producto sin stock suficiente, cuando se intenta confirmar la venta, entonces el sistema responde HTTP 409 y NO se descuenta inventario.
- CA-01.3: El total impreso en el ticket = subtotal + IVA, redondeado a 2 decimales (banker's rounding).
- CA-01.4: El tiempo desde POST /sales hasta respuesta es < 2 segundos en p95 con carrito ≤ 20 ítems.

### UC-02 / FR-02: Gestión de Productos
- Admin crea, edita y desactiva productos
- Campos: SKU, nombre, precio, stock, categoría, código de barras

**Criterios de aceptación:**
- CA-02.1: SKU y código de barras son únicos a nivel global.
- CA-02.2: El delete es lógico (`is_active=false`); el producto sigue consultable desde historial de ventas.
- CA-02.3: Precio debe ser > 0; stock debe ser ≥ 0.

### UC-03 / FR-03: Métodos de Pago
- Efectivo con cálculo automático de cambio
- Tarjeta (integración mock con terminal)
- Transferencia y QR

**Criterios de aceptación:**
- CA-03.1: Pago en efectivo: `cash_received >= total`; sistema calcula `change_given = cash_received - total`.
- CA-03.2: Pago con tarjeta: mock devuelve `approved` o `declined`; si `declined`, la venta queda en `cancelled` y NO descuenta inventario.
- CA-03.3: Cada método de pago queda registrado en `Sale.payment_method`.

### UC-04 / FR-04: Devoluciones
- Supervisor busca ticket por ID o rango de fecha
- Selecciona productos a devolver (total o parcial)
- Sistema revierte inventario y emite nota de crédito

**Criterios de aceptación:**
- CA-04.1: Solo Supervisor o Admin pueden ejecutar `POST /sales/{id}/refund`.
- CA-04.2: La devolución parcial soporta indicar qué `SaleItem` y qué cantidad devolver.
- CA-04.3: El stock se incrementa exactamente en la cantidad devuelta.
- CA-04.4: Se genera un registro `CreditNote` ligado al `Sale` original y queda evidencia en `AuditLog`.

### UC-05 / FR-05: Reportes
- Ventas del día / semana / mes
- Productos más vendidos
- Corte de caja por cajero/turno

**Criterios de aceptación:**
- CA-05.1: El corte diario suma todas las ventas en estado `completed` del rango horario `[00:00, 23:59:59]` de la zona horaria America/Mexico_City.
- CA-05.2: El reporte por cajero muestra: total cobrado por método de pago, número de tickets, devoluciones del turno.
- CA-05.3: Solo Supervisor o Admin pueden acceder a los endpoints `/reports/*`.

## 5. Requerimientos No Funcionales

| ID | Categoría | Requerimiento | Métrica/Aceptación |
|---|---|---|---|
| NFR-01 | Rendimiento | Tiempo de respuesta por transacción de venta | p95 < 2s con carrito ≤ 20 ítems |
| NFR-02 | Seguridad | Autenticación obligatoria | JWT en todos los endpoints excepto `POST /auth/login` |
| NFR-03 | Seguridad | RBAC | Cajero/Supervisor/Admin con permisos diferenciados (ver design §5) |
| NFR-04 | Seguridad | Passwords | bcrypt factor ≥ 12 |
| NFR-05 | Seguridad | Rate limiting | 100 req/min por IP en API Gateway |
| NFR-06 | Auditoría | Log de auditoría | Toda operación sobre Sale, Refund, Product (create/update/delete) genera registro en `AuditLog` |
| NFR-07 | Observabilidad | Logging estructurado | JSON con `trace_id`, exportable a CloudWatch |
| NFR-08 | Disponibilidad | SLA de servicio | 99.5% mensual (horario operativo) |
| NFR-09 | Localización | Moneda y zona horaria | MXN, America/Mexico_City |
| NFR-10 | Calidad | Cobertura de tests | ≥ 70% en módulos `app/sales`, `app/products`, `app/auth` |

## 6. Fuera de Alcance (Out of Scope) — v1.0
- Facturación CFDI 4.0 ante SAT (solo ticket simplificado en esta versión).
- **Modo offline real**: la versión 1.0 NO incluye cola offline. Si el POS pierde conectividad, no procesa ventas. Se difiere a v2.0.
- Multi-moneda y tipos de cambio.
- Promociones, cupones y programas de lealtad.
- Integración con terminal bancaria real (en v1.0 es mock).
- App móvil; el cliente es navegador/terminal con HTTP.
- Internacionalización (i18n); todo en español de México.

## 7. Supuestos
- Cada cajero tiene exactamente un usuario asignado a una sucursal.
- El régimen fiscal aplicable es el de la persona moral operadora (IVA 16% trasladado).
- La red de la tienda es estable durante el horario operativo (justifica diferir modo offline a v2.0).
- La impresora de tickets es independiente: el sistema entrega el ticket como texto plano y PDF, no maneja drivers de impresora.

## 8. Dependencias Externas
- AWS (Lambda, API Gateway, Step Functions, Secrets Manager, CloudWatch).
- PostgreSQL gestionado (RDS o equivalente).
- Redis gestionado (ElastiCache o equivalente).
- Mock de terminal bancaria (servicio interno simulado en v1.0).

## 9. Stack Técnico
| Capa | Tecnología |
|---|---|
| Backend | Python 3.11 + FastAPI |
| Base de datos | PostgreSQL |
| Cache | Redis |
| Deploy | AWS Lambda + API Gateway (Mangum) |
| Orquestación | Step Functions (flujo de venta) |
| Auth | JWT (HS256, expiración 8h) + bcrypt |

## Changelog
| Versión | Fecha | Descripción |
|---|---|---|
| 1.0.0 | 2026-05-31 | Versión inicial |
| 1.1.0 | 2026-05-31 | IDs FR/NFR estables, criterios de aceptación por UC, glosario, fuera-de-alcance, supuestos, dependencias. Decisión: modo offline difierido a v2.0 |
