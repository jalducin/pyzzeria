# Tasks — pyzzeria-sprint1

Transformar el demo POS en **Pyzzeria**: sistema serverless de pedidos de pizza en AWS Free Tier.
Rama de sprint: `sprint/2026-04` · Feature branch: `feature/pyzzeria-sprint1`

---

## Step 0 — Crear feature branch (OBLIGATORIO — SIEMPRE PRIMERO)

- [x] `git checkout main && git pull origin main`
- [x] `git checkout -b sprint/2026-04 && git push -u origin sprint/2026-04`
- [x] `git checkout -b feature/pyzzeria-sprint1`
- [x] Renombrar repo GitHub: `gh repo rename pyzzeria` (el directorio local queda como está)
- [x] Actualizar remote: `git remote set-url origin https://github.com/jalducin/pyzzeria`

---

## Step 1 — Preparar entorno y dependencias

- [x] Crear `requirements.txt` nuevo:
  ```
  fastapi
  mangum
  boto3
  pydantic>=2
  uvicorn   # solo dev local
  moto[dynamodb]  # solo tests
  pytest
  pytest-cov
  httpx
  ```
- [x] Instalar: `pip install -r requirements.txt`
- [x] Verificar que `aws` CLI y `sam` CLI están disponibles: `sam --version`

---

## Step 2 — IaC: template.yaml (SAM)

- [x] Crear `template.yaml` en raíz con:
  - `PyzzeriaFunction` — Lambda principal (FastAPI + Mangum), Python 3.12, handler `backend.main.handler`
  - `PyzzeriaWsConnectFunction` — `backend.ws_handlers.connect.handler`
  - `PyzzeriaWsDisconnectFunction` — `backend.ws_handlers.disconnect.handler`
  - `PyzzeriaStatusUpdateFunction` — `backend.ws_handlers.status_update.handler`
  - `HttpApi` — API Gateway HTTP API, rutas `ANY /api/{proxy+}` → `PyzzeriaFunction`
  - `WebSocketApi` — API Gateway WebSocket API con rutas `$connect`, `$disconnect`, `$default`
  - `OrdersTable` — DynamoDB, BillingMode: PAY_PER_REQUEST, PK: `orderId`
  - `WsConnectionsTable` — DynamoDB, PAY_PER_REQUEST, PK: `connectionId`, TTL en campo `ttl`
  - `OrderTrackerStateMachine` — Step Functions Express, definición inline en template
  - `FrontendBucket` — S3, BlockPublicAccess, acceso solo por CloudFront OAC
  - `CloudFrontDistribution` — OAC + S3 origin + cache behaviors
- [x] Crear `samconfig.toml` con stack name `pyzzeria`, región `us-east-2`, confirm changeset `false`

---

## Step 3 — Backend: menú hardcoded (`backend/menu.py`)

- [x] Crear `backend/menu.py` con constantes `SIZES` y `TOPPINGS` (dicts, no DynamoDB)
- [x] `SIZES`: lista de 3 dicts `{id, name, diameter_cm, base_price}`
- [x] `TOPPINGS`: lista de 10 dicts `{id, name, price, category}`
- [x] Función `get_size(size_id)` → dict o None
- [x] Función `get_topping(topping_id)` → dict o None
- [x] Función `get_toppings_by_category(category)` → lista filtrada

---

## Step 4 — Backend: helper DynamoDB (`backend/dynamo.py`)

- [x] Crear `backend/dynamo.py` con:
  - `get_orders_table()` → recurso DynamoDB tabla orders (usa env var `ORDERS_TABLE`)
  - `get_connections_table()` → recurso DynamoDB tabla connections (usa env var `WS_CONNECTIONS_TABLE`)
  - `create_order(order_dict)` → PUT item en orders
  - `get_order(order_id)` → GET item, retorna dict o None
  - `update_order_status(order_id, status)` → UPDATE expression en orders
  - `list_orders_by_status(statuses)` → Scan con FilterExpression (válido para demo; no prod)
  - `save_connection(connection_id, order_id, ttl_seconds=7200)` → PUT en connections
  - `delete_connection(connection_id)` → DELETE de connections
  - `get_connections_for_order(order_id)` → Scan connections WHERE orderId = X

---

## Step 5 — Backend: app FastAPI principal (`backend/main.py`)

Reescritura completa. Mantiene FastAPI + Mangum para conservar Swagger.

- [x] Schemas Pydantic:
  - `SizeResponse`, `ToppingResponse`
  - `OrderCreate` (customer_name, size_id, topping_ids con validaciones)
  - `SizeSnapshot`, `ToppingSnapshot`
  - `OrderResponse` (id, customer_name, sizeSnapshot, toppingSnapshots, total, status, createdAt, updatedAt, estimatedSeconds)
- [x] `GET /api/menu/sizes` → retorna `SIZES` desde `menu.py`
- [x] `GET /api/menu/toppings?category=` → retorna toppings filtrados
- [x] `POST /api/orders`:
  1. Validar `size_id` existe (404 si no)
  2. Validar cada `topping_id` existe (404 si no)
  3. Calcular `total`
  4. Construir snapshots
  5. `create_order(...)` en DynamoDB
  6. Iniciar Step Functions Express: `sfn_client.start_execution(stateMachineArn, input=json.dumps({orderId}))`
  7. Retornar HTTP 201 con `OrderResponse`
- [x] `GET /api/orders/{order_id}` → `get_order(id)`, 404 si no existe
- [x] `GET /api/orders?status=` → `list_orders_by_status(statuses.split(","))`
- [x] Agregar `handler = Mangum(app)` al final
- [x] Documentar todos los endpoints con `summary`, `description`, `responses` (golden rule #1)

---

## Step 6 — Backend: handlers WebSocket (`backend/ws_handlers/`)

- [x] `backend/ws_handlers/__init__.py` (vacío)
- [x] `backend/ws_handlers/connect.py`:
  - Extrae `connectionId` del evento Lambda
  - Extrae `orderId` de `queryStringParameters`
  - Llama `save_connection(connectionId, orderId)`
  - Retorna `{"statusCode": 200}`
- [x] `backend/ws_handlers/disconnect.py`:
  - Extrae `connectionId`
  - Llama `delete_connection(connectionId)`
  - Retorna `{"statusCode": 200}`
- [x] `backend/ws_handlers/status_update.py`:
  - Input: `{orderId, newStatus, estimatedSeconds}`
  - `update_order_status(orderId, newStatus)`
  - `connections = get_connections_for_order(orderId)`
  - Para cada `connectionId`: `apigw_mgmt.post_to_connection(Data=json_msg, ConnectionId=cid)`
  - Si respuesta 410: `delete_connection(cid)`
  - Retorna `{"statusCode": 200}`

---

## Step 7 — Step Functions: definición de la máquina de estados

- [x] Crear `statemachine/order_tracker.asl.json` con Express Workflow:
  ```json
  {
    "Comment": "Pyzzeria order state simulator",
    "StartAt": "WaitToPreparando",
    "States": {
      "WaitToPreparando":   { "Type": "Wait", "Seconds": 8,  "Next": "SetPreparando" },
      "SetPreparando":      { "Type": "Task", "Resource": "${StatusUpdateFunctionArn}",
                              "Parameters": {"orderId.$": "$.orderId", "newStatus": "preparando", "estimatedSeconds": 12},
                              "Next": "WaitToHorno" },
      "WaitToHorno":        { "Type": "Wait", "Seconds": 12, "Next": "SetHorno" },
      "SetHorno":           { "Type": "Task", "Resource": "${StatusUpdateFunctionArn}",
                              "Parameters": {"orderId.$": "$.orderId", "newStatus": "horno", "estimatedSeconds": 20},
                              "Next": "WaitToListo" },
      "WaitToListo":        { "Type": "Wait", "Seconds": 20, "Next": "SetListo" },
      "SetListo":           { "Type": "Task", "Resource": "${StatusUpdateFunctionArn}",
                              "Parameters": {"orderId.$": "$.orderId", "newStatus": "listo", "estimatedSeconds": 30},
                              "Next": "WaitToEntregado" },
      "WaitToEntregado":    { "Type": "Wait", "Seconds": 30, "Next": "SetEntregado" },
      "SetEntregado":       { "Type": "Task", "Resource": "${StatusUpdateFunctionArn}",
                              "Parameters": {"orderId.$": "$.orderId", "newStatus": "entregado", "estimatedSeconds": null},
                              "End": true }
    }
  }
  ```

---

## Step 8 — Frontend: index.html (4 pantallas SPA)

- [x] Reescribir `frontend/index.html` con 4 secciones (`<section id="screen-X">`):
  - `screen-size`: grid de 3 cards de tamaño con precio
  - `screen-toppings`: checkboxes agrupados por categoría + precio total reactivo + botón Siguiente
  - `screen-name`: input `customer_name` + resumen del pedido + botón "Ordenar"
  - `screen-tracker`: stepper de 5 pasos con íconos + nombre cliente + resumen
- [x] Banner demo fijo en header: "🍕 Pyzzeria Demo · Sin pagos reales"
- [x] Botón "Ver API Spec" en header → `target="_blank"` a URL del Swagger desplegado (variable en `config.js`)

---

## Step 9 — Frontend: style.css

- [x] Paleta: fondo oscuro `#1a1a1a`, acento rojo-tomate `#e63946`, texto crema
- [x] Cards de tamaño con hover effect + borde activo cuando seleccionado
- [x] Checkboxes de toppings estilizados (sin checkbox nativo, usar cards clicables)
- [x] Stepper tracker: línea horizontal con 5 nodos, estado activo animado con pulso
- [x] Responsivo: mobile-first, grid de cards colapsable
- [x] Transición suave entre pantallas (fade in/out via CSS)

---

## Step 10 — Frontend: app.js

- [x] Estado global `appState` con `screen`, `selectedSize`, `selectedToppings[]`, `customerName`, `currentOrder`, `ws`
- [x] `initApp()`: carga menú desde API, muestra screen-size
- [x] `showScreen(name)`: oculta todas las secciones, muestra la indicada, fade transition
- [x] `selectSize(sizeId)`: actualiza `appState.selectedSize`, avanza a screen-toppings
- [x] `toggleTopping(toppingId)`: agrega/quita de `appState.selectedToppings`, actualiza precio total
- [x] `updatePriceDisplay()`: recalcula total en tiempo real
- [x] `submitOrder()`: `POST /api/orders`, guarda `currentOrder`, conecta WebSocket, muestra screen-tracker
- [x] `connectWebSocket(orderId)`: abre `wss://...?orderId=X`, maneja `onmessage` → `updateStepper(status)`
- [x] `updateStepper(status)`: avanza el stepper visual al estado indicado
- [x] `reconnectWithBackoff()`: reintentos 1s/2s/4s si WS se cae
- [x] `frontend/config.js`: constantes `API_BASE_URL` y `WS_URL` (se actualizan al hacer deploy)

---

## Step 11 — Script de seed data (`scripts/seed.py`)

- [x] Crear `scripts/seed.py` que inserta 3 pedidos demo en DynamoDB:
  - Ana García — Mediana + Pepperoni + Champiñones — status: `horno`
  - Carlos Ruiz — Grande + Extra mozzarella + Gorgonzola + Aceitunas — status: `preparando`
  - Demo User — Chica + Pepperoni — status: `listo`
- [x] Los pedidos seed tienen `isSeed: true` en DynamoDB para distinguirlos
- [x] Ejecutable con: `python scripts/seed.py --table-name pyzzeria-orders --region us-east-2`

---

## Step 12 — Tests (OBLIGATORIO)

Revisar y reescribir toda la suite de tests. Tests existentes en `tests/` son para el POS y no aplican.

- [x] `tests/conftest.py`: fixtures con `moto` para mockear DynamoDB; `TestClient` de FastAPI
- [x] `tests/test_menu.py`:
  - `test_list_sizes_returns_3_items`
  - `test_list_toppings_returns_10_items`
  - `test_list_toppings_filter_by_category`
  - `test_list_toppings_unknown_category_returns_empty`
- [x] `tests/test_orders.py`:
  - `test_create_order_exitoso_retorna_201`
  - `test_create_order_sin_toppings`
  - `test_create_order_size_invalido_retorna_404`
  - `test_create_order_topping_invalido_retorna_404`
  - `test_create_order_demasiados_toppings_retorna_422`
  - `test_create_order_nombre_vacio_retorna_422`
  - `test_get_order_existente`
  - `test_get_order_inexistente_retorna_404`
  - `test_list_orders_by_status`
  - `test_snapshot_inmutabilidad` (total calculado servidor-side)
- [x] `tests/test_swagger.py`:
  - `test_openapi_json_accesible`
  - `test_swagger_docs_accesible`
- [x] Cobertura mínima: 80% (logrado: 94.67%)

---

## Step 13 — Ejecutar pruebas y verificar estado (OBLIGATORIO — EL AGENTE EJECUTA)

- [x] `pytest tests/ --tb=short --cov=backend --cov-report=term-missing -q`
- [x] Confirmar: 0 fallos, cobertura ≥ 80%
- [x] Cobertura mínima: 80% (golden rule #3)
- [x] Crear reporte en `openspec/changes/pyzzeria-sprint1/reports/2026-06-24-step13-pruebas.md`

---

## Step 14 — Verificación manual local (OBLIGATORIO — EL AGENTE EJECUTA)

Levantar la app localmente con uvicorn (sin SAM) para verificar endpoints REST:

- [x] `uvicorn backend.main:app --reload --port 8002`
- [x] `curl http://localhost:8002/api/menu/sizes` → 200, 3 tamaños
- [x] `curl http://localhost:8002/api/menu/toppings` → 200, 10 toppings
- [x] `curl http://localhost:8002/api/menu/toppings?category=carnes` → 200, 3 toppings
- [x] POST /api/orders → verificado post-deploy (DynamoDB no disponible local, esperado)
- [x] `curl -X POST ... size_id=99` → 404 ✓
- [x] `curl http://localhost:8002/openapi.json` → 200
- [x] `curl http://localhost:8002/docs` → 200
- [x] Restaurar estado: proceso uvicorn terminado, sin DB local que restaurar

---

## Step 15 — Actualizar documentación técnica (OBLIGATORIO)

- [x] Actualizar `openspec/config.yaml` — contexto nuevo stack (Lambda + DynamoDB + SAM)
- [x] Actualizar `openspec/project.md` — nuevo dominio y arquitectura
- [x] Actualizar `README.md` — nuevo nombre Pyzzeria, comandos `sam build && sam deploy`, setup local con `uvicorn`
- [x] Archivar spec anterior: mover `openspec/specs/pos-venta/` → `openspec/specs/pos-venta/_archived/`
- [x] Actualizar `.github/workflows/ci.yml` — reemplazar `pytest` directo por versión con moto; mantener swagger check
- [x] `openspec/changes/tech_debt.md` ya commiteado en sesión anterior

---

## Step 16 — Commit y PR (OBLIGATORIO)

- [x] `git add` de todos los archivos modificados/creados
- [x] Commit: `feat(pyzzeria): sprint 1 — serverless pizza ordering demo (Lambda + DynamoDB + SAM + WebSocket)`
- [x] `git push -u origin feature/pyzzeria-sprint1`
- [x] Crear PR: `feature/pyzzeria-sprint1` → `sprint/2026-04` (PR #7)
- [x] Esperar CI verde — Tests + Swagger: PASS
- [x] Merge PR a sprint
- [x] Crear PR: `sprint/2026-04` → `main`, esperar CI, merge (PR #8)

---

## Step 17 — Deploy a AWS (OBLIGATORIO — primer deploy)

- [x] `sam build` (fix: requirements.txt → solo Lambda deps; requirements-dev.txt para dev/CI)
- [x] `sam deploy` usando samconfig.toml — stack `pyzzeria` en `us-east-2`
- [x] Outputs: HttpApiUrl `https://t7jcupvl4m.execute-api.us-east-2.amazonaws.com`, WebSocketUrl `wss://63jv69f3jc.execute-api.us-east-2.amazonaws.com/prod`, CloudFront `d3ni8wwgux3wy8.cloudfront.net`
- [x] Actualizar `frontend/config.js` con las URLs reales de AWS
- [x] `aws s3 sync frontend/ s3://pyzzeria-frontend-957266312835/ --delete` — 4 archivos subidos
- [x] `aws cloudfront create-invalidation --distribution-id E1TAKN9B0M4WQ1 --paths "/*"` ✓
- [x] `python scripts/seed.py --table-name pyzzeria-orders --region us-east-2` — 3 pedidos demo insertados
- [x] Verificar `/api/menu/sizes` → HTTP 200, 3 items; `/openapi.json` → HTTP 200; `/docs` → HTTP 200
- [x] POST /api/orders → HTTP 201, status `recibido`, estimatedSeconds `8`, Step Functions iniciado

---

## Checklist de cierre (golden rules)

- [x] `/openapi.json` y `/docs` accesibles en URL de producción — HTTP 200 confirmado
- [x] Todos los endpoints tienen `summary` y schemas documentados
- [x] Auth fuera de alcance en v1 — documentado en descripción de la API
- [x] 18 tests (5 menu + 11 orders + 2 swagger), cobertura 94.67% ≥ 80%
- [x] CI verde en todos los PRs (PR #7 feature→sprint, PR #8 sprint→main)
- [x] URL pública `https://d3ni8wwgux3wy8.cloudfront.net` funcionando; POST→201→Step Functions iniciado
