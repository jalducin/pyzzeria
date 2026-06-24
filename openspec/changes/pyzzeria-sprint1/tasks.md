# Tasks — pyzzeria-sprint1

Transformar el demo POS en **Pyzzeria**: sistema serverless de pedidos de pizza en AWS Free Tier.
Rama de sprint: `sprint/2026-04` · Feature branch: `feature/pyzzeria-sprint1`

---

## Step 0 — Crear feature branch (OBLIGATORIO — SIEMPRE PRIMERO)

- [ ] `git checkout main && git pull origin main`
- [ ] `git checkout -b sprint/2026-04 && git push -u origin sprint/2026-04`
- [ ] `git checkout -b feature/pyzzeria-sprint1`
- [ ] Renombrar repo GitHub: `gh repo rename pyzzeria` (el directorio local queda como está)
- [ ] Actualizar remote: `git remote set-url origin https://github.com/jalducin/pyzzeria`

---

## Step 1 — Preparar entorno y dependencias

- [ ] Crear `requirements.txt` nuevo:
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
- [ ] Instalar: `pip install -r requirements.txt`
- [ ] Verificar que `aws` CLI y `sam` CLI están disponibles: `sam --version`

---

## Step 2 — IaC: template.yaml (SAM)

- [ ] Crear `template.yaml` en raíz con:
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
- [ ] Crear `samconfig.toml` con stack name `pyzzeria`, región `us-east-1`, confirm changeset `false`

---

## Step 3 — Backend: menú hardcoded (`backend/menu.py`)

- [ ] Crear `backend/menu.py` con constantes `SIZES` y `TOPPINGS` (dicts, no DynamoDB)
- [ ] `SIZES`: lista de 3 dicts `{id, name, diameter_cm, base_price}`
- [ ] `TOPPINGS`: lista de 10 dicts `{id, name, price, category}`
- [ ] Función `get_size(size_id)` → dict o None
- [ ] Función `get_topping(topping_id)` → dict o None
- [ ] Función `get_toppings_by_category(category)` → lista filtrada

---

## Step 4 — Backend: helper DynamoDB (`backend/dynamo.py`)

- [ ] Crear `backend/dynamo.py` con:
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

- [ ] Schemas Pydantic:
  - `SizeResponse`, `ToppingResponse`
  - `OrderCreate` (customer_name, size_id, topping_ids con validaciones)
  - `SizeSnapshot`, `ToppingSnapshot`
  - `OrderResponse` (id, customer_name, sizeSnapshot, toppingSnapshots, total, status, createdAt, updatedAt, estimatedSeconds)
- [ ] `GET /api/menu/sizes` → retorna `SIZES` desde `menu.py`
- [ ] `GET /api/menu/toppings?category=` → retorna toppings filtrados
- [ ] `POST /api/orders`:
  1. Validar `size_id` existe (404 si no)
  2. Validar cada `topping_id` existe (404 si no)
  3. Calcular `total`
  4. Construir snapshots
  5. `create_order(...)` en DynamoDB
  6. Iniciar Step Functions Express: `sfn_client.start_execution(stateMachineArn, input=json.dumps({orderId}))`
  7. Retornar HTTP 201 con `OrderResponse`
- [ ] `GET /api/orders/{order_id}` → `get_order(id)`, 404 si no existe
- [ ] `GET /api/orders?status=` → `list_orders_by_status(statuses.split(","))`
- [ ] Agregar `handler = Mangum(app)` al final
- [ ] Documentar todos los endpoints con `summary`, `description`, `responses` (golden rule #1)

---

## Step 6 — Backend: handlers WebSocket (`backend/ws_handlers/`)

- [ ] `backend/ws_handlers/__init__.py` (vacío)
- [ ] `backend/ws_handlers/connect.py`:
  - Extrae `connectionId` del evento Lambda
  - Extrae `orderId` de `queryStringParameters`
  - Llama `save_connection(connectionId, orderId)`
  - Retorna `{"statusCode": 200}`
- [ ] `backend/ws_handlers/disconnect.py`:
  - Extrae `connectionId`
  - Llama `delete_connection(connectionId)`
  - Retorna `{"statusCode": 200}`
- [ ] `backend/ws_handlers/status_update.py`:
  - Input: `{orderId, newStatus, estimatedSeconds}`
  - `update_order_status(orderId, newStatus)`
  - `connections = get_connections_for_order(orderId)`
  - Para cada `connectionId`: `apigw_mgmt.post_to_connection(Data=json_msg, ConnectionId=cid)`
  - Si respuesta 410: `delete_connection(cid)`
  - Retorna `{"statusCode": 200}`

---

## Step 7 — Step Functions: definición de la máquina de estados

- [ ] Crear `statemachine/order_tracker.asl.json` con Express Workflow:
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

- [ ] Reescribir `frontend/index.html` con 4 secciones (`<section id="screen-X">`):
  - `screen-size`: grid de 3 cards de tamaño con precio
  - `screen-toppings`: checkboxes agrupados por categoría + precio total reactivo + botón Siguiente
  - `screen-name`: input `customer_name` + resumen del pedido + botón "Ordenar"
  - `screen-tracker`: stepper de 5 pasos con íconos + nombre cliente + resumen
- [ ] Banner demo fijo en header: "🍕 Pyzzeria Demo · Sin pagos reales"
- [ ] Botón "Ver API Spec" en header → `target="_blank"` a URL del Swagger desplegado (variable en `config.js`)

---

## Step 9 — Frontend: style.css

- [ ] Paleta: fondo oscuro `#1a1a1a`, acento rojo-tomate `#e63946`, texto crema
- [ ] Cards de tamaño con hover effect + borde activo cuando seleccionado
- [ ] Checkboxes de toppings estilizados (sin checkbox nativo, usar cards clicables)
- [ ] Stepper tracker: línea horizontal con 5 nodos, estado activo animado con pulso
- [ ] Responsivo: mobile-first, grid de cards colapsable
- [ ] Transición suave entre pantallas (fade in/out via CSS)

---

## Step 10 — Frontend: app.js

- [ ] Estado global `appState` con `screen`, `selectedSize`, `selectedToppings[]`, `customerName`, `currentOrder`, `ws`
- [ ] `initApp()`: carga menú desde API, muestra screen-size
- [ ] `showScreen(name)`: oculta todas las secciones, muestra la indicada, fade transition
- [ ] `selectSize(sizeId)`: actualiza `appState.selectedSize`, avanza a screen-toppings
- [ ] `toggleTopping(toppingId)`: agrega/quita de `appState.selectedToppings`, actualiza precio total
- [ ] `updatePriceDisplay()`: recalcula total en tiempo real
- [ ] `submitOrder()`: `POST /api/orders`, guarda `currentOrder`, conecta WebSocket, muestra screen-tracker
- [ ] `connectWebSocket(orderId)`: abre `wss://...?orderId=X`, maneja `onmessage` → `updateStepper(status)`
- [ ] `updateStepper(status)`: avanza el stepper visual al estado indicado
- [ ] `reconnectWithBackoff()`: reintentos 1s/2s/4s si WS se cae
- [ ] `frontend/config.js`: constantes `API_BASE_URL` y `WS_URL` (se actualizan al hacer deploy)

---

## Step 11 — Script de seed data (`scripts/seed.py`)

- [ ] Crear `scripts/seed.py` que inserta 3 pedidos demo en DynamoDB:
  - Ana García — Mediana + Pepperoni + Champiñones — status: `horno`
  - Carlos Ruiz — Grande + Extra mozzarella + Gorgonzola + Aceitunas — status: `preparando`
  - Demo User — Chica + Pepperoni — status: `listo`
- [ ] Los pedidos seed tienen `isSeed: true` en DynamoDB para distinguirlos
- [ ] Ejecutable con: `python scripts/seed.py --table-name pyzzeria-orders --region us-east-1`

---

## Step 12 — Tests (OBLIGATORIO)

Revisar y reescribir toda la suite de tests. Tests existentes en `tests/` son para el POS y no aplican.

- [ ] `tests/conftest.py`: fixtures con `moto` para mockear DynamoDB; `TestClient` de FastAPI
- [ ] `tests/test_menu.py`:
  - `test_list_sizes_returns_3_items`
  - `test_list_toppings_returns_10_items`
  - `test_list_toppings_filter_by_category`
  - `test_list_toppings_unknown_category_returns_empty`
- [ ] `tests/test_orders.py`:
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
- [ ] `tests/test_swagger.py`:
  - `test_openapi_json_accesible`
  - `test_swagger_docs_accesible`
- [ ] Cobertura mínima: 80% (golden rule #3)

---

## Step 13 — Ejecutar pruebas y verificar estado (OBLIGATORIO — EL AGENTE EJECUTA)

- [ ] `pytest tests/ --tb=short --cov=backend --cov-report=term-missing -q`
- [ ] Confirmar: 0 fallos, cobertura ≥ 80%
- [ ] Crear reporte en `openspec/changes/pyzzeria-sprint1/reports/2026-06-20-step13-pruebas.md`

---

## Step 14 — Verificación manual local (OBLIGATORIO — EL AGENTE EJECUTA)

Levantar la app localmente con uvicorn (sin SAM) para verificar endpoints REST:

- [ ] `uvicorn backend.main:app --reload --port 8002`
- [ ] `curl http://localhost:8002/api/menu/sizes` → 200, 3 tamaños
- [ ] `curl http://localhost:8002/api/menu/toppings` → 200, 10 toppings
- [ ] `curl http://localhost:8002/api/menu/toppings?category=carnes` → 200, 3 toppings
- [ ] `curl -X POST http://localhost:8002/api/orders -H "Content-Type: application/json" -d '{"customer_name":"Test","size_id":2,"topping_ids":[7,3]}'` → 201 con UUID
- [ ] `curl http://localhost:8002/api/orders/{uuid_del_paso_anterior}` → 200
- [ ] `curl -X POST ... size_id=99` → 404
- [ ] `curl http://localhost:8002/openapi.json` → 200
- [ ] `curl http://localhost:8002/docs` → 200
- [ ] Restaurar estado: eliminar DB local si aplica

---

## Step 15 — Actualizar documentación técnica (OBLIGATORIO)

- [ ] Actualizar `openspec/config.yaml` — contexto nuevo stack (Lambda + DynamoDB + SAM)
- [ ] Actualizar `openspec/project.md` — nuevo dominio y arquitectura
- [ ] Actualizar `README.md` — nuevo nombre Pyzzeria, comandos `sam build && sam deploy`, setup local con `uvicorn`
- [ ] Archivar spec anterior: mover `openspec/specs/pos-venta/` → `openspec/specs/pos-venta/_archived/`
- [ ] Actualizar `.github/workflows/ci.yml` — reemplazar `pytest` directo por versión con moto; mantener swagger check
- [ ] Commitear `openspec/changes/tech_debt.md` (quedó sin trackear)

---

## Step 16 — Commit y PR (OBLIGATORIO)

- [ ] `git add` de todos los archivos modificados/creados
- [ ] Commit: `feat(pyzzeria): sprint 1 — serverless pizza ordering demo (Lambda + DynamoDB + SAM + WebSocket)`
- [ ] `git push -u origin feature/pyzzeria-sprint1`
- [ ] Crear PR: `feature/pyzzeria-sprint1` → `sprint/2026-04`
- [ ] Esperar CI verde
- [ ] Merge PR a sprint
- [ ] Crear PR: `sprint/2026-04` → `main`, esperar CI, merge

---

## Step 17 — Deploy a AWS (OBLIGATORIO — primer deploy)

- [ ] `sam build`
- [ ] `sam deploy --guided` (primera vez — configurar stack name `pyzzeria`, región `us-east-1`)
- [ ] Anotar outputs: `HttpApiUrl`, `WebSocketUrl`, `CloudFrontDomain`
- [ ] Actualizar `frontend/config.js` con las URLs reales de AWS
- [ ] `aws s3 sync frontend/ s3://{FrontendBucket}/ --delete`
- [ ] `aws cloudfront create-invalidation --distribution-id {id} --paths "/*"`
- [ ] Ejecutar seed: `python scripts/seed.py --table-name pyzzeria-orders --region us-east-1`
- [ ] Verificar URL pública de CloudFront: flujo completo de pedido en el navegador

---

## Checklist de cierre (golden rules)

- [ ] `/openapi.json` y `/docs` accesibles en URL de producción (CI lo verifica)
- [ ] Todos los endpoints tienen `summary` y schemas documentados
- [ ] Auth fuera de alcance en v1 — documentado en descripción de la API
- [ ] ≥ 18 tests (3 specs × ~6 escenarios), cobertura ≥ 80%
- [ ] CI verde en todos los PRs
- [ ] URL pública funcionando con ciclo completo de tracker en ~70s
