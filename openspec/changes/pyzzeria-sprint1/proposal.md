## Why

El demo POS actual (producto genérico + SQLite + monolito local) no transmite las capacidades serverless
de AWS que son centrales en el perfil técnico. Transformarlo en **Pyzzeria** — un sistema de pedidos de
pizza con tracker en tiempo real — permite demostrar Lambda, DynamoDB, Step Functions, API Gateway
WebSocket y S3+CloudFront en un solo proyecto de portafolio accesible por URL pública, sin costo fijo
y desplegable con un comando.

## What Changes

- **BREAKING** — Dominio completo: `products/sales/users` → `menu/orders` (pizzas con toppings y estados)
- **BREAKING** — Infraestructura: SQLite local → DynamoDB on-demand; FastAPI local → Lambda + Mangum
- **BREAKING** — Despliegue: `uvicorn` local → SAM (`sam build && sam deploy`)
- **BREAKING** — Frontend: SPA de una pantalla (carrito) → flujo de 4 pantallas (tamaño → toppings → nombre → tracker)
- Nuevo: tracker en tiempo real vía WebSocket (API Gateway WebSocket API + Step Functions)
- Nuevo: seed data demo con 3 pedidos pre-cargados en diferentes estados
- Nuevo: banner "Demo · Sin pagos reales" visible en toda la app
- Nuevo: botón "Ver API Spec" en el frontend enlaza al Swagger UI desplegado
- Renombrar repo GitHub: `pos-retail-sdd` → `pyzzeria`

## Capabilities

### New Capabilities

- `pizza-menu`: Catálogo de tamaños (chica/mediana/grande) y toppings (10 opciones en 4 categorías) servido desde Lambda + DynamoDB
- `order-flow`: Creación de pedido sin autenticación — nombre ficticio + tamaño + toppings → Order con UUID, total calculado y snapshot inmutable
- `order-tracker`: Tracking en tiempo real del pedido a través de 5 estados (recibido → preparando → horno → listo → entregado) mediante WebSocket push; transiciones simuladas con Step Functions Express Workflow

### Modified Capabilities

- `pos-venta`: Reemplazada completamente por las tres capabilities nuevas. El spec original queda
  archivado; no genera delta spec sino spec nuevo.

## Impact

- `backend/` — reescritura completa: `main.py` (FastAPI + Mangum), `database.py` → `dynamo.py`, handlers WS separados
- `frontend/` — reescritura completa: 4 pantallas en JS vainilla, WebSocket client
- `tests/` — nuevos tests contra TestClient + DynamoDB local (moto)
- `.github/workflows/ci.yml` — actualizar para SAM + moto en lugar de SQLite
- `template.yaml` — nuevo (SAM): Lambda, API Gateway HTTP, API Gateway WebSocket, DynamoDB, Step Functions, S3, CloudFront
- `openspec/config.yaml` — actualizar contexto al nuevo stack
- `openspec/specs/pos-venta/` — archivar (queda como referencia histórica)
