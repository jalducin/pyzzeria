# Design — Pyzzeria Sprint 1

## Decisiones de arquitectura

### 1. Runtime: FastAPI + Mangum (no reescritura a handlers nativos)

FastAPI se mantiene como framework principal. Mangum actúa como adaptador ASGI→Lambda event,
permitiendo conservar el contrato OpenAPI/Swagger generado automáticamente (`/docs`, `/openapi.json`)
y reutilizar la lógica de validación Pydantic. La alternativa (handlers Lambda nativos) eliminaría
el Swagger automático y rompería la narrativa SDD.

**Trade-off aceptado**: paquete Lambda ligeramente mayor (~8 MB con dependencias) vs. mantenibilidad y
coherencia con el spec.

### 2. Base de datos: DynamoDB on-demand (tabla única por entidad)

Tres tablas simples en lugar de diseño single-table, para legibilidad en un demo de portafolio:

| Tabla | PK | SK | Atributos principales |
|-------|----|----|----------------------|
| `pyzzeria_orders` | `orderId` (UUID) | — | `customerName`, `sizeSnapshot`, `toppingSnapshots`, `total`, `status`, `createdAt`, `updatedAt` |
| `pyzzeria_ws_connections` | `connectionId` | — | `orderId`, `ttl` (TTL auto-limpieza 2h) |
| (menu) | hardcoded en Lambda | — | Tamaños y toppings son datos estáticos; no requieren tabla |

**Justificación de menu hardcoded**: los 3 tamaños y 10 toppings no cambian en el demo. Elimina
latencia de lectura en cada request de menú y simplifica el IaC.

### 3. Tracker en tiempo real: Step Functions Express + API Gateway WebSocket

```
POST /api/orders
  → Lambda crea Order en DynamoDB (status: recibido)
  → Lambda inicia Step Functions Express Workflow (input: {orderId})

Step Functions Express Workflow:
  recibido (inicial)
  → Wait 8s  → Task: UpdateStatus(preparando) + PushWS
  → Wait 12s → Task: UpdateStatus(horno)      + PushWS
  → Wait 20s → Task: UpdateStatus(listo)      + PushWS
  → Wait 30s → Task: UpdateStatus(entregado)  + PushWS

PushWS Lambda:
  1. Lee ws_connections WHERE orderId = X
  2. Para cada connectionId: ApiGatewayManagementApi.post_to_connection(...)
  3. Si la conexión está muerta (410): elimina de DynamoDB
```

**¿Por qué Express Workflow y no Standard?** Express es más barato para ejecuciones frecuentes y
cortas (<5 min). El demo completo dura ~70s → Express ideal. Standard tiene mejor visibilidad en
consola pero cuesta más por ejecución.

### 4. IaC: AWS SAM

`template.yaml` define todos los recursos. Un solo comando despliega todo:
```bash
sam build && sam deploy --guided   # primera vez
sam deploy                          # siguientes
```

Recursos SAM:
- `PyzzeriaFunction` — Lambda principal (FastAPI + Mangum), Python 3.12
- `PyzzeriaWsConnectFunction` — Lambda WS @connect
- `PyzzeriaWsDisconnectFunction` — Lambda WS @disconnect
- `PyzzeriaStatusUpdateFunction` — Lambda llamada por Step Functions para update + push WS
- `HttpApi` — API Gateway HTTP API (rutas `/api/*` → `PyzzeriaFunction`)
- `WebSocketApi` — API Gateway WebSocket API
- `OrdersTable` — DynamoDB on-demand
- `WsConnectionsTable` — DynamoDB on-demand, TTL habilitado en campo `ttl`
- `OrderTrackerStateMachine` — Step Functions Express Workflow
- `FrontendBucket` — S3 bucket, acceso solo desde CloudFront (OAC)
- `CloudFrontDistribution` — CDN, HTTPS, cache de assets estáticos

### 5. Frontend: 4 pantallas en JS vainilla (SPA sin framework)

Estado global en objeto `appState`:
```js
const appState = {
  screen: 'size',        // 'size' | 'toppings' | 'name' | 'tracker'
  selectedSize: null,
  selectedToppings: [],  // [toppingId, ...]
  customerName: '',
  currentOrder: null,    // OrderResponse
  ws: null,              // WebSocket instance
};
```

Transición de pantallas via `showScreen(name)` que oculta/muestra secciones del DOM.
No hay router — todo vive en `index.html`, montado en el mismo S3 bucket.

### 6. Seed data demo

Cargado en DynamoDB al hacer `sam deploy` via un Lambda custom resource (o script separado `seed.py`).
Tres pedidos pre-cargados en estado permanente (no avanzan automáticamente — son "congelados"):

| Cliente | Pizza | Estado visible |
|---------|-------|---------------|
| Ana García | Mediana — Pepperoni + Champiñones | horno 🔥 |
| Carlos Ruiz | Grande — 4 quesos | preparando 👨‍🍳 |
| Demo User | Chica — Pepperoni | listo ✅ |

Los pedidos reales (creados por visitantes) sí avanzan automáticamente vía Step Functions.

### 7. Snapshot inmutabilidad

Al crear un pedido, `sizeSnapshot` y `toppingSnapshots` almacenan nombre y precio del momento.
Si el menú cambiara, los pedidos históricos conservan los valores originales. Mismo patrón que el
POS original.

### 8. OpenAPI / Swagger en producción

FastAPI genera `/openapi.json` y `/docs` accesibles tras el API Gateway HTTP API. El frontend
incluye un botón "Ver API Spec" que enlaza a la URL pública del Swagger UI.

## Diagrama de flujo de datos

```
Visitante
  │
  ├─ GET /api/menu/sizes         → Lambda → menu hardcoded
  ├─ GET /api/menu/toppings      → Lambda → menu hardcoded
  ├─ POST /api/orders            → Lambda → DynamoDB + Step Functions start
  │
  ├─ WSS connect (orderId param) → WS Lambda → DynamoDB ws_connections INSERT
  │
  └─ Step Functions transitions:
       cada estado → Lambda → DynamoDB UPDATE + WSS push → cliente ve stepper avanzar
```

## Estructura de carpetas tras el cambio

```
pyzzeria/                        ← (renombrado de pos-retail-sdd)
├── backend/
│   ├── main.py                  ← FastAPI app (reescritura dominio pizza)
│   ├── dynamo.py                ← helpers DynamoDB (reemplaza database.py)
│   ├── menu.py                  ← datos estáticos de tamaños y toppings
│   └── ws_handlers/
│       ├── connect.py           ← Lambda @connect
│       ├── disconnect.py        ← Lambda @disconnect
│       └── status_update.py     ← Lambda llamada por Step Functions
├── frontend/
│   ├── index.html               ← 4 pantallas (SPA)
│   ├── style.css
│   └── app.js                   ← lógica 4 pantallas + WebSocket client
├── tests/
│   ├── conftest.py              ← fixtures con moto (DynamoDB mock)
│   ├── test_menu.py
│   ├── test_orders.py
│   └── test_tracker.py
├── template.yaml                ← SAM IaC
├── samconfig.toml               ← configuración de deploy (stack name, región)
└── scripts/
    └── seed.py                  ← carga seed data en DynamoDB
```
