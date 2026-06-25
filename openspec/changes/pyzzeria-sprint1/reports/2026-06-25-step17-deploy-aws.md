# Reporte Step 17 — Deploy a AWS + Verificación de producción

- Fecha: 2026-06-25
- Cambio: pyzzeria-sprint1
- Agente: claude-sonnet-4-6

## Problemas resueltos antes del deploy

### 1. sam build fallaba con `{pywin32==312(wheel)}`
- **Causa**: `requirements.txt` tenía `uvicorn[standard]`, que en Windows trae `winloop` → `pywin32` (paquete Windows-only). SAM construye para Lambda/Linux y no puede resolver la wheel.
- **Fix**: Separar dependencias en `requirements.txt` (solo Lambda: fastapi, mangum, boto3, pydantic) y `requirements-dev.txt` (hereda requirements.txt + uvicorn, moto, pytest, pytest-cov, httpx). Actualizado CI para instalar `requirements-dev.txt`.

### 2. sam deploy fallaba con dependencia circular
- **Causa**: `Globals.Environment.STATE_MACHINE_ARN: !Ref OrderTrackerStateMachine` se aplicaba a `PyzzeriaStatusUpdateFunction`, que a su vez es referenciada por `OrderTrackerStateMachine` → ciclo.
- **Fix**: Quitar `STATE_MACHINE_ARN` de Globals; agregarlo solo en `PyzzeriaFunction.Properties.Environment` (la única que lo necesita).

### 3. seed.py fallaba con `TypeError: Float types are not supported`
- **Causa**: boto3 DynamoDB resource no acepta `float`; los precios en seed eran `float` Python.
- **Fix**: Agregar `_to_decimal()` recursivo en seed.py (mismo patrón que dynamo.py).

## Comandos ejecutados

```
sam build --no-cached                    → Build Succeeded
sam deploy                               → Successfully created/updated stack - pyzzeria in us-east-2
aws s3 sync frontend/ s3://pyzzeria-frontend-957266312835/ --delete   → 4 archivos subidos
aws cloudfront create-invalidation --distribution-id E1TAKN9B0M4WQ1 --paths "/*"  → InProgress
python scripts/seed.py --table-name pyzzeria-orders --region us-east-2  → 3 pedidos seed
```

## Outputs del stack

| Key | Value |
|-----|-------|
| HttpApiUrl | `https://t7jcupvl4m.execute-api.us-east-2.amazonaws.com` |
| WebSocketUrl | `wss://63jv69f3jc.execute-api.us-east-2.amazonaws.com/prod` |
| CloudFrontDomain | `d3ni8wwgux3wy8.cloudfront.net` |
| FrontendBucketName | `pyzzeria-frontend-957266312835` |
| CloudFront Dist ID | `E1TAKN9B0M4WQ1` |

## Verificación de producción

| Endpoint | Resultado |
|----------|-----------|
| GET /api/menu/sizes | HTTP 200, 3 tamaños |
| GET /openapi.json | HTTP 200 |
| GET /docs | HTTP 200 |
| POST /api/orders | HTTP 201, status: recibido, estimatedSeconds: 8, Step Functions iniciado |
| CloudFront / | HTTP 200, HTML de la SPA |

## Resultado

- Estado Step 17: **PASS**
- Bloqueos: ninguno
- Stack en producción: `pyzzeria` en `us-east-2`
- Frontend público: `https://d3ni8wwgux3wy8.cloudfront.net`
